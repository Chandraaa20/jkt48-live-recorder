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

  // The browser is an observer. Cloudflare Worker is the sole live dispatcher.
  const loadAllData = useCallback(async (silent = false) => {
    if (!silent) setIsRefreshing(true);
    try {
      const supabase = getSupabaseClient();
      setIsConnected(Boolean(supabase));

      const [membersData, livesData, recordingsData] = await Promise.all([
        getMembers(),
        getActiveLives(),
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

    // Refresh the Worker-owned state; never create notifications or recordings here.
    const liveSyncInterval = setInterval(() => {
      getActiveLives().then(setActiveLives).catch(console.error);
    }, 60000);

    return () => {
      cleanupRealtime();
      clearInterval(liveSyncInterval);
    };
  }, [loadAllData]);

  // Refresh only when entering the live tab.
  useEffect(() => {
    if (currentTab === TABS.LIVE) {
      getActiveLives().then(setActiveLives).catch(console.error);
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
          />
        )}

        {currentTab === TABS.MEMBERS && (
          <MemberView
            members={members}
            recordings={recordings}
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
