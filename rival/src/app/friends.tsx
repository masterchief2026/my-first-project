import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

type UserResult = {
  id: string;
  display_name: string | null;
  email: string;
  isFollowing: boolean;
};

type Friend = {
  id: string;
  display_name: string | null;
  email: string;
  weekly_score: number;
};

function getMondayStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function FriendsScreen() {
  const [currentUserId, setCurrentUserId] = useState('');
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    await loadFriends(user.id);
    setLoading(false);
  }

  async function loadFriends(userId: string) {
    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    if (!followData || followData.length === 0) {
      setFriends([]);
      return;
    }

    const ids = followData.map((f: any) => f.following_id);

    const { data: usersData } = await supabase
      .from('users')
      .select('id, display_name, email')
      .in('id', ids);

    if (!usersData) return;

    const weekStart = getMondayStart(new Date());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const friendsWithScores = await Promise.all(
      usersData.map(async (u: any) => {
        const { data: acts } = await supabase
          .from('activities')
          .select('effort_score')
          .eq('user_id', u.id)
          .gte('started_at', weekStart.toISOString())
          .lt('started_at', weekEnd.toISOString());

        const weekly = acts?.reduce((sum, a) => sum + (a.effort_score || 0), 0) ?? 0;
        return {
          ...u,
          weekly_score: Math.round(weekly * 10) / 10,
        };
      })
    );

    friendsWithScores.sort((a, b) => b.weekly_score - a.weekly_score);
    setFriends(friendsWithScores);
  }

  async function search(text: string) {
    setQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);

    const { data: followData } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', currentUserId);

    const followingIds = new Set((followData || []).map((f: any) => f.following_id));

    const { data } = await supabase
      .from('users')
      .select('id, display_name, email')
      .or(`display_name.ilike.%${text}%,email.ilike.%${text}%`)
      .neq('id', currentUserId)
      .limit(10);

    if (data) {
      setSearchResults(
        data.map((u: any) => ({
          ...u,
          isFollowing: followingIds.has(u.id),
        }))
      );
    }

    setSearching(false);
  }

  async function toggleFollow(user: UserResult) {
    if (user.isFollowing) {
      await supabase
        .from('follows')
        .delete()
        .eq('follower_id', currentUserId)
        .eq('following_id', user.id);
    } else {
      await supabase
        .from('follows')
        .insert({ follower_id: currentUserId, following_id: user.id });
    }

    // Update search results immediately
    setSearchResults((prev) =>
      prev.map((u) => u.id === user.id ? { ...u, isFollowing: !u.isFollowing } : u)
    );

    // Refresh friends list
    await loadFriends(currentUserId);
  }

  function getDisplayName(u: { display_name: string | null; email: string }) {
    return u.display_name || u.email.split('@')[0];
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Friends</Text>

        {/* Search */}
        <View style={styles.searchRow}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name or email…"
            placeholderTextColor="#666666"
            value={query}
            onChangeText={search}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searching && <ActivityIndicator color="#E91E8C" style={styles.searchSpinner} />}
        </View>

        {searchResults.length > 0 && (
          <View style={styles.resultsCard}>
            {searchResults.map((user) => (
              <View key={user.id} style={styles.resultRow}>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultName}>{getDisplayName(user)}</Text>
                  <Text style={styles.resultEmail}>{user.email}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.followButton, user.isFollowing && styles.followingButton]}
                  onPress={() => toggleFollow(user)}
                >
                  <Text style={[styles.followButtonText, user.isFollowing && styles.followingButtonText]}>
                    {user.isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Friends list */}
        <Text style={styles.sectionTitle}>Following</Text>

        {loading && <Text style={styles.emptyText}>Loading…</Text>}

        {!loading && friends.length === 0 && (
          <Text style={styles.emptyText}>Search for friends above to follow them.</Text>
        )}

        {friends.map((friend, index) => (
          <View key={friend.id} style={styles.friendRow}>
            <Text style={styles.friendRank}>{index + 1}.</Text>
            <View style={styles.friendInfo}>
              <Text style={styles.friendName}>{getDisplayName(friend)}</Text>
              <Text style={styles.friendSub}>This week</Text>
            </View>
            <Text style={styles.friendScore}>{friend.weekly_score} pts</Text>
          </View>
        ))}

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
    marginBottom: 20,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 14,
    color: '#FFFFFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#8DC63F',
  },
  searchSpinner: {
    marginLeft: 12,
  },
  resultsCard: {
    backgroundColor: '#111111',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#8DC63F',
    marginBottom: 24,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#8DC63F',
  },
  resultInfo: {
    flex: 1,
    gap: 2,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultEmail: {
    fontSize: 12,
    color: '#999999',
  },
  followButton: {
    backgroundColor: '#E91E8C',
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E91E8C',
  },
  followButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  followingButtonText: {
    color: '#E91E8C',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 14,
    marginTop: 8,
  },
  emptyText: {
    color: '#999999',
    fontSize: 15,
    textAlign: 'center',
    paddingVertical: 24,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: '#8DC63F',
  },
  friendRank: {
    fontSize: 16,
    color: '#999999',
    width: 24,
    textAlign: 'center',
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  friendSub: {
    fontSize: 12,
    color: '#999999',
  },
  friendScore: {
    fontSize: 18,
    fontWeight: '800',
    color: '#E91E8C',
  },
});
