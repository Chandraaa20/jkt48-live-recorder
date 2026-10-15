import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import BottomNav, { TABS } from './components/BottomNav';
import LivePlayerModal from './components/LivePlayerModal';
import MemberModal from './components/MemberModal';
import LiveView from './views/LiveView';
import MemberView from './views/MemberView';
import RecordingsView from './views/RecordingsView';
import SettingsView from './views/SettingsView';

import {
  getMembers,
  toggleAutoRecord,
  toggleNotify,
  saveMember,
  deleteMember,
  seedInitialMembers,
  getActiveLives,
  syncRealActiveLives,
  clearSimulatedLives,
  triggerManualRecord,
  getRecordings,
  finishRecording,
  setupRealtimeSubscription,
} from './services/dataService';
import {
  getSupabaseClient,
  sendTelegramNotification,
  sendDeviceNotification,
} from './services/supabase';

const getTabFromHash = () => {
  if (typeof window === 'undefined') return TABS.LIVE;
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase();
  if (hash === 'members' || hash === 'member') return TABS.MEMBERS;
  if (hash === 'recordings' || hash === 'arsip' || hash === 'rekaman') return TABS.RECORDINGS;
  if (hash === 'settings' || hash === 'pengaturan') return TABS.SETTINGS;
  return TABS.LIVE;
};

export default function App() {
  const [currentTab, setCurrentTab] = useState(getTabFromHash);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const handleHash = () => {
      setCurrentTab(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const handleTabChange = (newTab) => {
    setCurrentTab(newTab);
    try {
      window.location.hash = newTab;
    } catch (_) {}
  };

  // Core Data State
  const [members, setMembers] = useState([]);
  const [activeLives, setActiveLives] = useState([]);
  const [recordings, setRecordings] = useState([]);

  // Modals State
  const [selectedLive, setSelectedLive] = useState(null);
  const [isPlayerOpen, setIsPlayerOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState(null);
  const [isSeeding, setIsSeeding] = useState(false);

  // Fetch all data (Real-Time JKT48 Active Lives)
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const supabase = getSupabaseClient();
      setIsConnected(Boolean(supabase));

      const [membersData, livesData, recordingsData] = await Promise.all([
        getMembers(),
        syncRealActiveLives(),
        getRecordings(),
      ]);

      setMembers(membersData);
      setActiveLives(livesData);
      setRecordings(recordingsData);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial Load & Realtime Subscription
  useEffect(() => {
    loadAllData();

    // Listen to Supabase Realtime changes
    const cleanupRealtime = setupRealtimeSubscription({
      onLiveChange: () => {
        getActiveLives().then(setActiveLives);
      },
      onRecordingsChange: () => {
        getRecordings().then(setRecordings);
      },
      onMembersChange: () => {
        getMembers().then(setMembers);
      },
    });

    // Real-Time JKT48 Live Sync every 60 seconds
    const liveSyncInterval = setInterval(() => {
      syncRealActiveLives().then(setActiveLives).catch(console.error);
    }, 60000);

    return () => {
      cleanupRealtime();
      clearInterval(liveSyncInterval);
    };
  }, [loadAllData]);

  // Sync real-time lives automatically whenever user switches to "Sedang Live" tab
  useEffect(() => {
    if (currentTab === TABS.LIVE) {
      syncRealActiveLives().then(setActiveLives).catch(console.error);
    }
  }, [currentTab]);

  // Toggle Auto Record
  const handleToggleAutoRecord = async (memberId, currentValue) => {
    // Optimistic UI update
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, is_auto_record: !currentValue } : m
      )
    );
    await toggleAutoRecord(memberId, currentValue);
  };

  // Toggle Notify
  const handleToggleNotify = async (memberId, currentValue) => {
    // Optimistic UI update
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, is_notify: !currentValue } : m
      )
    );
    await toggleNotify(memberId, currentValue);
  };

  // Save Member (Add or Edit)
  const handleSaveMember = async (memberPayload, platforms) => {
    const res = await saveMember(memberPayload, platforms);
    if (res.success) {
      const refreshed = await getMembers();
      setMembers(refreshed);
    }
  };

  // Delete Member
  const handleDeleteMember = async (memberId) => {
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    await deleteMember(memberId);
  };

  // Seed Data
  const handleSeedData = async () => {
    setIsSeeding(true);
    try {
      const res = await seedInitialMembers();
      await loadAllData(true);
      return res;
    } finally {
      setIsSeeding(false);
    }
  };

  // Trigger Manual Cloud Recording
  const handleTriggerRecord = async (liveId, memberId, liveTitle, platform, memberName = '', streamUrl = '') => {
    // Optimistic update
    setActiveLives((prev) =>
      prev.map((l) => (l.id === liveId ? { ...l, is_recording: true } : l))
    );
    if (selectedLive && selectedLive.id === liveId) {
      setSelectedLive((prev) => ({ ...prev, is_recording: true }));
    }

    const res = await triggerManualRecord(liveId, memberId, liveTitle, platform, memberName, streamUrl);
    const refreshedRecs = await getRecordings();
    setRecordings(refreshedRecs);
    return res;
  };

  // Finish a Recording and Upload to Telegram
  const handleFinishRecording = async (recId) => {
    // Instantly mark UI as uploading
    setRecordings((prev) =>
      prev.map((r) =>
        r.id === recId ? { ...r, status: 'uploading' } : r
      )
    );
    try {
      await finishRecording(recId);
      const refreshedRecs = await getRecordings();
      setRecordings(refreshedRecs);
    } catch (err) {
      console.error('handleFinishRecording error:', err);
    }
  };

  // Simulate a test live stream (e.g. if list is empty or for instant player testing)
  const handleSimulateLive = async () => {
    const targetMember =
      members.find((m) => m.nickname === 'Freya') ||
      members[0] || {
        id: crypto.randomUUID(),
        name: 'Freya Jayawardana',
        nickname: 'Freya',
        avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&h=300&fit=crop',
      };

    const newSimulatedLive = {
      id: `live-sim-${Date.now()}`,
      member_id: targetMember.id,
      platform: 'idn',
      title: 'Malam mingguan bareng Freya! ✨ [Live Test]',
      stream_url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      thumbnail_url: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=600&h=340&fit=crop',
      started_at: new Date().toISOString(),
      is_recording: targetMember.is_auto_record ?? false,
      is_simulated: true,
      member: targetMember,
    };

    setActiveLives((prev) => [newSimulatedLive, ...prev]);

    // If member has is_auto_record = true, also spawn recording entry!
    if (targetMember.is_auto_record) {
      await triggerManualRecord(
        newSimulatedLive.id,
        targetMember.id,
        newSimulatedLive.title,
        newSimulatedLive.platform
      );
    }

    // If member has is_notify = true, send live notification!
    if (targetMember.is_notify !== false) {
      sendDeviceNotification(`🔴 ${targetMember.name} Sedang Live! (Simulasi)`, {
        body: 'IDN LIVE: Malam mingguan bareng Freya! ✨ [Live Test]',
        icon: targetMember.avatar_url,
      });

      sendTelegramNotification({
        text: `🔔 <b>JKT48 LIVE ALERT! [SIMULASI TEST]</b>\n\n` +
          `👤 <b>Member:</b> ${targetMember.name}\n` +
          `📺 <b>Platform:</b> IDN LIVE\n` +
          `📝 <b>Judul:</b> Malam mingguan bareng Freya! ✨ [Live Test]\n` +
          `⏺️ <b>Cloud Recording:</b> ${targetMember.is_auto_record ? '✅ AKTIF (Otomatis Merekam)' : '⏸️ Tidak Aktif'}\n\n` +
          `<i>Sesi simulasi uji coba player dan notifikasi.</i>`,
        photoUrl: newSimulatedLive.thumbnail_url,
      }).catch(() => {});
    }
  };

  // Clear simulated lives and return to pure real monitoring mode
  const handleClearSimulated = async () => {
    setIsRefreshing(true);
    try {
      const remaining = await clearSimulatedLives();
      setActiveLives(remaining);
      // Fetch fresh real JKT48 active lives
      const freshReal = await syncRealActiveLives();
      setActiveLives(freshReal);
    } catch (err) {
      console.error('Failed to clear simulated lives:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Open Player Modal
  const handleOpenPlayer = (live) => {
    setSelectedLive(live);
    setIsPlayerOpen(true);
  };


  // Count active recordings
  const activeRecCount = recordings.filter(
    (r) => r.status === 'recording' || r.status === 'uploading'
  ).length;

  return (
    <div className="min-h-screen bg-[#FAF8F2] text-[#2B2522] flex flex-col selection:bg-[#3D5E52] selection:text-white">
      {/* Top Mobile Header */}
      <Header
        isConnected={isConnected}
        activeLivesCount={activeLives.length}
        onRefresh={() => loadAllData(false)}
        isRefreshing={isRefreshing}
      />

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto">
        {currentTab === TABS.LIVE && (
          <LiveView
            lives={activeLives}
            loading={loading}
            onOpenPlayer={handleOpenPlayer}
            onTriggerRecord={handleTriggerRecord}
            onSimulateLive={handleSimulateLive}
            onClearSimulated={handleClearSimulated}
          />
        )}

        {currentTab === TABS.MEMBERS && (
          <MemberView
            members={members}
            loading={loading}
            onToggleAutoRecord={handleToggleAutoRecord}
            onToggleNotify={handleToggleNotify}
            onOpenAddModal={() => {
              setMemberToEdit(null);
              setIsMemberModalOpen(true);
            }}
            onOpenEditModal={(m) => {
              setMemberToEdit(m);
              setIsMemberModalOpen(true);
            }}
            onDeleteMember={handleDeleteMember}
            onSeedData={handleSeedData}
            isSeeding={isSeeding}
          />
        )}

        {currentTab === TABS.RECORDINGS && (
          <RecordingsView
            recordings={recordings}
            loading={loading}
            onFinishRecording={handleFinishRecording}
            onRefreshRecordings={() => loadAllData(false)}
          />
        )}

        {currentTab === TABS.SETTINGS && (
          <SettingsView
            onRefreshAll={() => loadAllData(false)}
            onResetData={handleSeedData}
          />
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <BottomNav
        currentTab={currentTab}
        onTabChange={handleTabChange}
        liveCount={activeLives.length}
        activeRecCount={activeRecCount}
      />

      {/* HLS Video Player Modal */}
      <LivePlayerModal
        live={selectedLive}
        isOpen={isPlayerOpen}
        onClose={() => setIsPlayerOpen(false)}
        onTriggerRecord={handleTriggerRecord}
      />

      {/* Add / Edit Member Modal */}
      <MemberModal
        isOpen={isMemberModalOpen}
        onClose={() => setIsMemberModalOpen(false)}
        onSave={handleSaveMember}
        memberToEdit={memberToEdit}
      />
    </div>
  );
}
