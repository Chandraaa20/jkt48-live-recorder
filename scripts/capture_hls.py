#!/usr/bin/env python3
"""
JKT48 Cloud Recorder - Universal HLS Capture Engine (Requests + SOCKS5)
Captures live HLS streams (.m3u8) directly or through SOCKS5 WARP proxy.
Uses requests.Session with full SSL/TLS SOCKS5h remote proxy support.
"""

import sys
import os
import time
import json
import urllib.parse
import requests

def get_headers(stream_url):
    is_showroom = "showroom" in stream_url.lower() or "sr-" in stream_url.lower()
    if is_showroom:
        return {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.showroom-live.com/',
            'Origin': 'https://www.showroom-live.com',
            'Accept': '*/*'
        }
    return {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.idn.app/',
        'Origin': 'https://www.idn.app',
        'Accept': '*/*'
    }

def create_session(proxy_host=None, proxy_port=None):
    session = requests.Session()
    if proxy_host and proxy_port:
        proxy_url = f"socks5h://{proxy_host}:{proxy_port}"
        session.proxies = {
            'http': proxy_url,
            'https': proxy_url
        }
        print(f"[CaptureHLS] SOCKS5h Remote Proxy Enabled -> {proxy_url}")
    return session

def check_supabase_stop(supabase_url, supabase_key, recording_id):
    if not supabase_url or not supabase_key or not recording_id:
        return False
    try:
        url = f"{supabase_url.rstrip('/')}/rest/v1/recordings?id=eq.{recording_id}&select=status"
        res = requests.get(url, headers={
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}'
        }, timeout=5)
        if res.ok:
            data = res.json()
            if data and len(data) > 0:
                status = data[0].get('status', '')
                if status in ('uploading', 'stopping', 'completed'):
                    return True
    except Exception:
        pass
    return False

def main():
    stream_url = sys.argv[1] if len(sys.argv) > 1 else ''
    output_path = sys.argv[2] if len(sys.argv) > 2 else 'raw_segments/rec_part_000.ts'
    duration = int(sys.argv[3]) if len(sys.argv) > 3 and sys.argv[3].isdigit() else 45
    recording_id = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != 'none' else None
    supabase_url = sys.argv[5] if len(sys.argv) > 5 and sys.argv[5] != 'none' else None
    supabase_key = sys.argv[6] if len(sys.argv) > 6 and sys.argv[6] != 'none' else None
    proxy_host = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] != 'none' else None
    proxy_port = sys.argv[8] if len(sys.argv) > 8 and sys.argv[8] != 'none' else None

    if not stream_url:
        print("[CaptureHLS] Error: stream_url is required.")
        sys.exit(1)

    headers = get_headers(stream_url)
    session = create_session(proxy_host, proxy_port)

    print(f"[CaptureHLS] Target Stream: {stream_url}")
    print(f"[CaptureHLS] Output TS File: {output_path}")
    print(f"[CaptureHLS] Duration Limit: {duration}s (0 = until stopped)")

    # 1. Fetch master playlist and resolve variant playlist
    variant_url = stream_url
    master_resp = None
    for attempt in range(1, 4):
        try:
            print(f"[CaptureHLS] Fetching master playlist (Attempt {attempt})...")
            master_resp = session.get(stream_url, headers=headers, timeout=12)
            if master_resp.status_code == 200:
                break
            print(f"[CaptureHLS] Master returned HTTP {master_resp.status_code}, retrying...")
            time.sleep(1.5)
        except Exception as e:
            print(f"[CaptureHLS] Master fetch exception: {e}")
            time.sleep(1.5)

    if not master_resp or master_resp.status_code != 200:
        print(f"[CaptureHLS] Failed to fetch master playlist: HTTP {master_resp.status_code if master_resp else 'ERR'}")
        sys.exit(1)

    master_text = master_resp.text
    for line in master_text.splitlines():
        line = line.strip()
        if line and not line.startswith('#'):
            variant_url = urllib.parse.urljoin(stream_url, line)
            break

    print(f"[CaptureHLS] Resolved Variant Stream: {variant_url}")

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    downloaded = set()
    total_bytes = 0
    total_segments = 0
    start_time = time.time()
    last_supabase_check = 0

    with open(output_path, 'wb') as out_f:
        while True:
            elapsed = time.time() - start_time
            if duration > 0 and elapsed >= duration:
                print(f"[CaptureHLS] Reached requested duration of {duration}s. Ending capture.")
                break

            # Check for user stop signal in Supabase every 5 seconds
            if recording_id and (time.time() - last_supabase_check > 5):
                last_supabase_check = time.time()
                if check_supabase_stop(supabase_url, supabase_key, recording_id):
                    print(f"[CaptureHLS] Supabase stop signal detected (user clicked stop). Ending capture.")
                    break

            try:
                var_resp = session.get(variant_url, headers=headers, timeout=10)
                if var_resp.status_code == 200:
                    var_text = var_resp.text
                    seg_urls = []
                    for line in var_text.splitlines():
                        line = line.strip()
                        if line and not line.startswith('#'):
                            seg_urls.append(urllib.parse.urljoin(variant_url, line))

                    for seg_url in seg_urls:
                        if seg_url not in downloaded:
                            downloaded.add(seg_url)
                            try:
                                seg_resp = session.get(seg_url, headers=headers, stream=True, timeout=12)
                                if seg_resp.status_code == 200:
                                    seg_size = 0
                                    for chunk in seg_resp.iter_content(chunk_size=65536):
                                        if chunk:
                                            out_f.write(chunk)
                                            seg_size += len(chunk)
                                    out_f.flush()
                                    total_bytes += seg_size
                                    total_segments += 1
                                    mb = total_bytes / (1024 * 1024)
                                    print(f"[CaptureHLS] Segment {total_segments} ({seg_size/1024:.1f} KB) | Total: {mb:.2f} MB | Elapsed: {elapsed:.0f}s")
                                else:
                                    print(f"[CaptureHLS] Segment HTTP {seg_resp.status_code}")
                            except Exception as se:
                                print(f"[CaptureHLS] Warning fetching segment: {se}")
            except Exception as pe:
                print(f"[CaptureHLS] Playlist poll error: {pe}")

            time.sleep(2)

    final_mb = total_bytes / (1024 * 1024)
    final_dur = time.time() - start_time
    print(f"[CaptureHLS] Capture complete: {total_segments} segments, {final_mb:.2f} MB written to {output_path} in {final_dur:.1f}s.")

    if total_bytes < 50000:
        print("[CaptureHLS] Warning: Captured file size is under 50KB.")
        sys.exit(1)
    
    sys.exit(0)

if __name__ == '__main__':
    main()
