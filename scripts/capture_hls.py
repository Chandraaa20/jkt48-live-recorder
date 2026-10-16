#!/usr/bin/env python3
"""
JKT48 Cloud Recorder - Universal Split-Fetch HLS Capture Engine
Architected for GitHub Actions Cloud Execution:
1. Playlist Fetcher: Automatically resolves ID/SG/MY/TH/JP proxies when 403 Forbidden
   is encountered on Amazon IVS / CDN playlists, caching the working proxy for .m3u8 polling.
2. Segment Downloader: Direct gigabit connection from GitHub Actions runner for .ts video chunks
   (since CloudFront/IVS media segments are not geo-blocked).
"""

import sys
import os
import time
import json
import urllib.parse
import concurrent.futures
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

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

class ProxyPool:
    @staticmethod
    def gather_proxies():
        proxies = set()
        print("[ProxyPool] Gathering proxy list from public APIs (ID, SG, MY, TH, JP)...")

        # 1. Proxyscrape HTTP (ID, SG, MY, TH, JP)
        try:
            r = requests.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=3500&country=ID,SG,MY,TH,JP', timeout=4)
            if r.status_code == 200:
                for line in r.text.splitlines():
                    line = line.strip()
                    if line and ':' in line:
                        proxies.add(f'http://{line}')
        except Exception:
            pass

        # 2. Proxyscrape SOCKS5 (ID, SG, MY, TH, JP)
        try:
            r = requests.get('https://api.proxyscrape.com/v2/?request=displayproxies&protocol=socks5&timeout=3500&country=ID,SG,MY,TH,JP', timeout=4)
            if r.status_code == 200:
                for line in r.text.splitlines():
                    line = line.strip()
                    if line and ':' in line:
                        proxies.add(f'socks5://{line}')
        except Exception:
            pass

        # 3. Geonode ID & SG
        for country in ['ID', 'SG']:
            try:
                r = requests.get(f'https://proxylist.geonode.com/api/proxy-list?country={country}&limit=40&page=1&sort_by=lastChecked&sort_type=desc', timeout=4)
                if r.status_code == 200:
                    for item in r.json().get('data', []):
                        ip = item.get('ip')
                        port = item.get('port')
                        protos = item.get('protocols', ['http'])
                        proto = protos[0] if protos else 'http'
                        if ip and port:
                            proxies.add(f'{proto}://{ip}:{port}')
            except Exception:
                pass

        # 4. Monosans & TheSpeedX curated lists
        try:
            r = requests.get('https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt', timeout=4)
            if r.status_code == 200:
                for line in r.text.splitlines()[:60]:
                    line = line.strip()
                    if line and ':' in line:
                        proxies.add(f'http://{line}')
        except Exception:
            pass

        try:
            r = requests.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt', timeout=4)
            if r.status_code == 200:
                for line in r.text.splitlines()[:60]:
                    line = line.strip()
                    if line and ':' in line:
                        proxies.add(f'http://{line}')
        except Exception:
            pass

        plist = list(proxies)
        print(f"[ProxyPool] Gathered {len(plist)} candidate proxies.")
        return plist

class PlaylistFetcher:
    def __init__(self, headers):
        self.headers = headers
        self.cached_proxy = None
        self.cached_session = None

    def fetch_playlist(self, url):
        # Playlist text is deliberately fetched through the Worker first.  Segments
        # remain direct below, so the runner retains gigabit throughput.
        encoded_target = urllib.parse.quote(url, safe='')
        cf_proxy_url = f"https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/stream.m3u8?url={encoded_target}"
        try:
            r = requests.get(cf_proxy_url, headers=self.headers, timeout=8)
            if r.status_code == 200 and '#EXTM3U' in r.text:
                print("[PlaylistFetcher] Cloudflare Worker proxy resolved playlist.")
                return r.text
            print(f"[PlaylistFetcher] Worker proxy returned HTTP {r.status_code}.")
        except Exception as e:
            print(f"[PlaylistFetcher] Worker proxy failed: {e}")

        # A 403 at the Worker edge falls back to nearby public egress then to
        # CORS text relays.  These only transfer small manifests, never video.
        print("[PlaylistFetcher] Resolving geo-bypass proxy for playlist (.m3u8)...")
        candidates = ProxyPool.gather_proxies()

        def test_proxy(proxy_str):
            try:
                s = requests.Session()
                s.proxies = {'http': proxy_str, 'https': proxy_str}
                r = s.get(url, headers=self.headers, timeout=3.5)
                if r.status_code == 200 and '#EXTM3U' in r.text:
                    return (proxy_str, s, r.text)
            except Exception:
                pass
            return None

        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
            future_to_proxy = {executor.submit(test_proxy, p): p for p in candidates}
            for future in concurrent.futures.as_completed(future_to_proxy):
                result = future.result()
                if result:
                    proxy_addr, sess, text = result
                    self.cached_proxy = proxy_addr
                    self.cached_session = sess
                    print(f"[PlaylistFetcher] SUCCESS: Connected via {proxy_addr} (HTTP 200 #EXTM3U).")
                    for f in future_to_proxy:
                        f.cancel()
                    return text

        for relay in ('https://api.allorigins.win/raw?url=', 'https://corsproxy.io/?url='):
            try:
                r = requests.get(relay + encoded_target, headers=self.headers, timeout=10)
                if r.status_code == 200 and '#EXTM3U' in r.text:
                    print(f"[PlaylistFetcher] CORS relay resolved playlist: {relay}")
                    return r.text
            except Exception:
                pass

        raise RuntimeError(f"Unable to fetch playlist: All direct and proxy attempts exhausted for {url}")

class SegmentDownloader:
    def __init__(self, headers):
        self.headers = headers
        self.session = requests.Session()
        adapter = HTTPAdapter(pool_connections=15, pool_maxsize=15, max_retries=Retry(total=2, backoff_factor=0.3))
        self.session.mount('http://', adapter)
        self.session.mount('https://', adapter)

    def download_segment(self, seg_url):
        # Direct Gigabit Download from GitHub Actions
        try:
            resp = self.session.get(seg_url, headers=self.headers, stream=True, timeout=10)
            if resp.status_code == 200:
                return resp
        except Exception:
            pass

        # Fallback via Cloudflare Worker if direct returned non-200
        try:
            encoded_seg = urllib.parse.quote(seg_url, safe='')
            proxy_url = f"https://jkt48-live-watcher.chandra02new.workers.dev/api/proxy/segment.ts?url={encoded_seg}"
            resp = self.session.get(proxy_url, headers=self.headers, stream=True, timeout=12)
            if resp.status_code == 200:
                return resp
        except Exception:
            pass

        return None

def check_supabase_stop(supabase_url, supabase_key, recording_id):
    if not supabase_url or not supabase_key or not recording_id:
        return False
    try:
        url = f"{supabase_url.rstrip('/')}/rest/v1/recordings?id=eq.{recording_id}&select=status"
        res = requests.get(url, headers={
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}'
        }, timeout=4)
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

    if not stream_url:
        print("[CaptureHLS] Error: stream_url is required.")
        sys.exit(1)

    headers = get_headers(stream_url)
    playlist_fetcher = PlaylistFetcher(headers)
    segment_downloader = SegmentDownloader(headers)

    print(f"[CaptureHLS] Target Stream: {stream_url}")
    print(f"[CaptureHLS] Output TS File: {output_path}")
    print(f"[CaptureHLS] Duration Limit: {duration}s (0 = until stopped)")

    # 1. Fetch initial playlist
    master_text = None
    for attempt in range(1, 4):
        try:
            print(f"[CaptureHLS] Fetching playlist (Attempt {attempt})...")
            master_text = playlist_fetcher.fetch_playlist(stream_url)
            if master_text:
                break
        except Exception as e:
            print(f"[CaptureHLS] Playlist fetch attempt {attempt} error: {e}")
            time.sleep(1.5)

    if not master_text:
        print("[CaptureHLS] Failed to fetch playlist.")
        sys.exit(1)

    # 2. Check if master playlist or media playlist
    is_master = '#EXT-X-STREAM-INF' in master_text
    variant_url = stream_url

    if is_master:
        lines = master_text.splitlines()
        for i, line in enumerate(lines):
            line = line.strip()
            if line.startswith('#EXT-X-STREAM-INF'):
                for next_line in lines[i+1:]:
                    next_line = next_line.strip()
                    if next_line and not next_line.startswith('#'):
                        variant_url = urllib.parse.urljoin(stream_url, next_line)
                        break
                break
        print(f"[CaptureHLS] Master Playlist parsed -> Variant Stream: {variant_url}")
        current_playlist_text = None
    else:
        print(f"[CaptureHLS] Media Playlist directly detected: {variant_url}")
        current_playlist_text = master_text

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

            # Check Supabase stop signal
            if recording_id and (time.time() - last_supabase_check > 5):
                last_supabase_check = time.time()
                if check_supabase_stop(supabase_url, supabase_key, recording_id):
                    print("[CaptureHLS] Supabase stop signal detected (user clicked stop). Ending capture.")
                    break

            try:
                # Use initial playlist text on first loop if media playlist
                if current_playlist_text is not None:
                    var_text = current_playlist_text
                    current_playlist_text = None
                else:
                    var_text = playlist_fetcher.fetch_playlist(variant_url)

                if var_text:
                    seg_urls = []
                    for line in var_text.splitlines():
                        line = line.strip()
                        if line and not line.startswith('#'):
                            seg_urls.append(urllib.parse.urljoin(variant_url, line))

                    for seg_url in seg_urls:
                        if seg_url not in downloaded:
                            downloaded.add(seg_url)
                            seg_resp = segment_downloader.download_segment(seg_url)
                            if seg_resp:
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
