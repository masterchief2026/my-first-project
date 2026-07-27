import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, Alert, Image, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '../lib/supabase';
import { formatDisplayName } from '../lib/identity';

// A crest (and the name baked into it) can change once every 6 months —
// often enough to fix a bad first attempt or reflect a real team change,
// rare enough that it still reads as an identity, not a disposable cosmetic.
// Mirrors the same check in supabase/functions/generate-team-crest/index.ts.
function nextCrestEligibleAt(generatedAt: string): Date {
  const d = new Date(generatedAt);
  d.setMonth(d.getMonth() + 6);
  return d;
}
function crestOnCooldown(generatedAt: string | null): boolean {
  if (!generatedAt) return false;
  return Date.now() < nextCrestEligibleAt(generatedAt).getTime();
}

type Member = {
  user_id: string;
  role: string;
  users: {
    display_name: string | null;
    email: string;
    username: string | null;
    display_style: string | null;
  };
};

export default function LeagueSettingsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [leagueName, setLeagueName] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState('');
  const [createdBy, setCreatedBy] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [crestGeneratedAt, setCrestGeneratedAt] = useState<string | null>(null);
  const [generatingCrest, setGeneratingCrest] = useState(false);
  const [crestError, setCrestError] = useState('');
  const [isPrivate, setIsPrivate] = useState(true);
  const [pendingRequests, setPendingRequests] = useState<Member[]>([]);
  const [respondingTo, setRespondingTo] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, [id]);

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // Verify user is admin
    const { data: membership } = await supabase
      .from('league_members')
      .select('role')
      .eq('league_id', id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (membership?.role !== 'admin') {
      router.replace('/home');
      return;
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('name, created_by, logo_url, is_private, crest_generated_at')
      .eq('id', id)
      .single();

    if (league) {
      setLeagueName(league.name);
      setNewName(league.name);
      setCreatedBy(league.created_by);
      setLogoUrl(league.logo_url || null);
      setIsPrivate(league.is_private !== false);
      setCrestGeneratedAt(league.crest_generated_at || null);
    }

    const { data: membersData } = await supabase
      .from('league_members')
      .select('user_id, role, users(display_name, email, username, display_style)')
      .eq('league_id', id)
      .eq('status', 'active');

    if (membersData) setMembers(membersData as any);

    const { data: pendingData } = await supabase
      .from('league_members')
      .select('user_id, role, users(display_name, email, username, display_style)')
      .eq('league_id', id)
      .eq('status', 'pending');

    if (pendingData) setPendingRequests(pendingData as any);
    setLoading(false);
  }

  async function respondToRequest(userId: string, approve: boolean) {
    setRespondingTo(userId);
    if (approve) {
      const { error } = await supabase.from('league_members').update({ status: 'active' }).eq('league_id', id).eq('user_id', userId);
      if (error) {
        Alert.alert("Couldn't approve", error.message);
        setRespondingTo(null);
        return;
      }
      const request = pendingRequests.find((m) => m.user_id === userId);
      if (request) setMembers((prev) => [...prev, request]);
    } else {
      const { error } = await supabase.from('league_members').delete().eq('league_id', id).eq('user_id', userId);
      if (error) {
        Alert.alert("Couldn't decline", error.message);
        setRespondingTo(null);
        return;
      }
    }
    setPendingRequests((prev) => prev.filter((m) => m.user_id !== userId));
    setRespondingTo(null);
  }

  async function generateCrest() {
    setGeneratingCrest(true);
    setCrestError('');
    const { data, error } = await supabase.functions.invoke('generate-team-crest', { body: { leagueId: id } });
    if (error || data?.error) {
      setCrestError(data?.error || error?.message || 'Crest generation failed');
      setGeneratingCrest(false);
      return;
    }
    setLogoUrl(data.url);
    setCrestGeneratedAt(new Date().toISOString());
    setGeneratingCrest(false);
  }

  async function saveName() {
    if (crestOnCooldown(crestGeneratedAt)) {
      setEditingName(false);
      return;
    }
    if (!newName.trim() || newName === leagueName) {
      setEditingName(false);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('leagues').update({ name: newName.trim() }).eq('id', id);
    if (!error) {
      setLeagueName(newName.trim());
      setEditingName(false);
    } else {
      setNewName(leagueName);
      setEditingName(false);
    }
    setSaving(false);
  }

  async function kickMember(userId: string) {
    const member = members.find((m) => m.user_id === userId);
    const name = member?.users ? formatDisplayName(member.users, 'this member') : 'this member';

    if (Platform.OS === 'web') {
      if (!window.confirm(`Remove ${name} from the team?`)) return;
    }

    const { error } = await supabase
      .from('league_members')
      .delete()
      .eq('league_id', id)
      .eq('user_id', userId);

    if (error) {
      Alert.alert("Couldn't remove member", error.message);
      return;
    }
    setMembers((prev) => prev.filter((m) => m.user_id !== userId));
  }

  async function toggleAdmin(userId: string, currentRole: string) {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    const { error } = await supabase
      .from('league_members')
      .update({ role: newRole })
      .eq('league_id', id)
      .eq('user_id', userId);

    if (error) {
      Alert.alert("Couldn't update role", error.message);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => m.user_id === userId ? { ...m, role: newRole } : m)
    );
  }

  function getDisplayName(member: Member) {
    return formatDisplayName(member.users);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace({ pathname: '/league', params: { id } })}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Team Settings</Text>

        {/* Crest — AI-generated only, so every team page shares one look
            instead of a mix of AI art and whatever photo someone had on
            hand. logoCard here is just a preview; the only action is
            generateCrest below. */}
        <Text style={styles.sectionLabel}>Team Crest</Text>
        <View style={styles.logoCard}>
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} style={styles.logoImage} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoPlaceholderIcon}>🏟️</Text>
              <Text style={styles.logoPlaceholderHint}>No crest yet</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.crestBtn, (generatingCrest || crestOnCooldown(crestGeneratedAt)) && styles.crestBtnDisabled]}
          onPress={generateCrest}
          disabled={generatingCrest || crestOnCooldown(crestGeneratedAt)}
        >
          <Text style={styles.crestBtnText}>
            {generatingCrest
              ? 'Generating…'
              : crestOnCooldown(crestGeneratedAt)
                ? `Next crest available ${nextCrestEligibleAt(crestGeneratedAt!).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}`
                : crestGeneratedAt ? '✨ Regenerate AI Crest' : '✨ Generate AI Crest'}
          </Text>
        </TouchableOpacity>
        {crestError ? <Text style={styles.crestErrorText}>{crestError}</Text> : null}

        {/* Rename */}
        <Text style={styles.sectionLabel}>Team Name</Text>
        <View style={styles.nameCard}>
          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                style={styles.nameInput}
                value={newName}
                onChangeText={setNewName}
                autoFocus
                autoCapitalize="words"
              />
              <TouchableOpacity style={styles.saveBtn} onPress={saveName} disabled={saving}>
                <Text style={styles.saveBtnText}>{saving ? '…' : 'Save'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setEditingName(false); setNewName(leagueName); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          ) : crestOnCooldown(crestGeneratedAt) ? (
            <View style={styles.nameRow}>
              <Text style={styles.nameText}>{leagueName}</Text>
              <Text style={styles.editHintLocked}>🔒 Locked</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.nameRow} onPress={() => setEditingName(true)}>
              <Text style={styles.nameText}>{leagueName}</Text>
              <Text style={styles.editHint}>✏️ Edit</Text>
            </TouchableOpacity>
          )}
        </View>
        {crestOnCooldown(crestGeneratedAt) ? (
          <Text style={styles.nameLockedHint}>Your AI crest has this name built into the artwork, so the name is locked until your next crest is available.</Text>
        ) : null}

        {/* Visibility */}
        <Text style={styles.sectionLabel}>Visibility</Text>
        <View style={styles.visibilityCard}>
          <View style={styles.visibilityRow}>
            <View>
              <Text style={styles.visibilityTitle}>{isPrivate ? '🔒 Private' : '🌍 Public'}</Text>
              <Text style={styles.visibilityDesc}>
                {isPrivate
                  ? 'Only people with the invite code can join.'
                  : 'Anyone can discover and join this team.'}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.visibilityToggle, !isPrivate && styles.visibilityToggleOn]}
              onPress={async () => {
                const newVal = !isPrivate;
                setIsPrivate(newVal);
                await supabase.from('leagues').update({ is_private: newVal }).eq('id', id);
              }}
            >
              <Text style={styles.visibilityToggleText}>{isPrivate ? 'Make Public' : 'Make Private'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Join Requests */}
        {pendingRequests.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Join Requests</Text>
            <View style={[styles.membersCard, { marginBottom: 28 }]}>
              {pendingRequests.map((request) => (
                <View key={request.user_id} style={styles.memberRow}>
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{formatDisplayName(request.users)}</Text>
                  </View>
                  <View style={styles.memberActions}>
                    <TouchableOpacity
                      style={styles.adminToggleBtn}
                      onPress={() => respondToRequest(request.user_id, true)}
                      disabled={respondingTo === request.user_id}
                    >
                      <Text style={styles.adminToggleText}>Approve</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.kickBtn}
                      onPress={() => respondToRequest(request.user_id, false)}
                      disabled={respondingTo === request.user_id}
                    >
                      <Text style={styles.kickText}>Decline</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Members */}
        <Text style={styles.sectionLabel}>Members</Text>
        <View style={styles.membersCard}>
          {members.map((member) => (
            <View key={member.user_id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberName}>
                  {getDisplayName(member)}
                  {member.user_id === currentUserId ? ' (you)' : ''}
                </Text>
                {member.role === 'admin' && (
                  <Text style={styles.adminBadge}>Admin</Text>
                )}
              </View>
              {member.user_id !== currentUserId && member.user_id !== createdBy && (
                <View style={styles.memberActions}>
                  <TouchableOpacity
                    style={styles.adminToggleBtn}
                    onPress={() => toggleAdmin(member.user_id, member.role)}
                  >
                    <Text style={styles.adminToggleText}>
                      {member.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.kickBtn}
                    onPress={() => kickMember(member.user_id)}
                  >
                    <Text style={styles.kickText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111111',
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#999999',
    fontSize: 16,
  },
  header: {
    marginBottom: 24,
  },
  back: {
    color: '#E91E8C',
    fontSize: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  visibilityCard: { backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#2A2A2A' },
  visibilityRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  visibilityTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF', marginBottom: 4 },
  visibilityDesc: { fontSize: 12, color: '#999999', flexShrink: 1 },
  visibilityToggle: { backgroundColor: '#0D0D0D', borderRadius: 10, paddingVertical: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#2A2A2A' },
  visibilityToggleOn: { backgroundColor: '#0A1A0F', borderColor: '#8DC63F' },
  visibilityToggleText: { fontSize: 12, fontWeight: '700', color: '#CCCCCC' },
  nameCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#8DC63F',
    marginBottom: 28,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  editHint: {
    fontSize: 13,
    color: '#E91E8C',
  },
  editHintLocked: {
    fontSize: 13,
    color: '#666666',
  },
  nameLockedHint: {
    fontSize: 12,
    color: '#666666',
    marginTop: -20,
    marginBottom: 20,
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  nameInput: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E91E8C',
  },
  saveBtn: {
    backgroundColor: '#E91E8C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelText: {
    color: '#999999',
    fontSize: 13,
  },
  logoCard: { backgroundColor: '#1A1A1A', borderRadius: 12, borderWidth: 1, borderColor: '#8DC63F', marginBottom: 28, overflow: 'hidden', alignItems: 'center' },
  logoImage: { width: '100%', height: 160 },
  logoPlaceholder: { paddingVertical: 32, alignItems: 'center', gap: 8 },
  logoPlaceholderIcon: { fontSize: 36 },
  logoPlaceholderHint: { fontSize: 13, color: '#666666' },
  crestBtn: { marginTop: 10, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#E91E8C' },
  crestBtnDisabled: { backgroundColor: '#2A2A2A' },
  crestBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  crestErrorText: { color: '#FF6B6B', fontSize: 13, marginTop: 6 },
  membersCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8DC63F',
    overflow: 'hidden',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#3d1a6e',
  },
  memberInfo: {
    flex: 1,
    gap: 2,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  adminBadge: {
    fontSize: 11,
    color: '#999999',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  memberActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  adminToggleBtn: {
    borderWidth: 1,
    borderColor: '#E91E8C',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  adminToggleText: {
    color: '#E91E8C',
    fontSize: 12,
    fontWeight: '600',
  },
  kickBtn: {
    borderWidth: 1,
    borderColor: '#dc2626',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  kickText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '600',
  },
});
