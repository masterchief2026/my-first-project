import { useEffect, useState } from 'react';
import { StyleSheet, TouchableOpacity, View, Text, TextInput, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { supabase } from '../lib/supabase';

type ScoringRow = {
  activity_type: string;
  multiplier: number;
  editing: boolean;
  draft: string;
};

export default function AdminScreen() {
  const [rows, setRows] = useState<ScoringRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [newType, setNewType] = useState('');
  const [newMultiplier, setNewMultiplier] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    init();
  }, []);

  async function init() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.replace('/home'); return; }

    const { data: userData } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!userData?.is_admin) { router.replace('/home'); return; }
    setIsAdmin(true);

    const { data } = await supabase
      .from('scoring_config')
      .select('activity_type, multiplier')
      .order('activity_type');

    if (data) {
      setRows(data.map((r: any) => ({ ...r, editing: false, draft: String(r.multiplier) }))
        .sort((a: ScoringRow, b: ScoringRow) => b.multiplier - a.multiplier));
    }
    setLoading(false);
  }

  function startEdit(type: string) {
    setRows((prev) => prev.map((r) => r.activity_type === type ? { ...r, editing: true } : r));
  }

  function updateDraft(type: string, val: string) {
    setRows((prev) => prev.map((r) => r.activity_type === type ? { ...r, draft: val } : r));
  }

  async function saveRow(type: string) {
    const row = rows.find((r) => r.activity_type === type);
    if (!row) return;
    const val = parseFloat(row.draft);
    if (isNaN(val) || val <= 0) return;

    setSaving(type);
    const { error } = await supabase
      .from('scoring_config')
      .update({ multiplier: val })
      .eq('activity_type', type);

    if (!error) {
      setRows((prev) => prev.map((r) =>
        r.activity_type === type ? { ...r, multiplier: val, editing: false } : r
      ).sort((a, b) => b.multiplier - a.multiplier));
    }
    setSaving(null);
  }

  function cancelEdit(type: string) {
    setRows((prev) => prev.map((r) =>
      r.activity_type === type ? { ...r, editing: false, draft: String(r.multiplier) } : r
    ));
  }

  async function addRow() {
    const type = newType.trim();
    const val = parseFloat(newMultiplier);
    if (!type || isNaN(val) || val <= 0) return;
    if (rows.find((r) => r.activity_type.toLowerCase() === type.toLowerCase())) return;

    setAdding(true);
    const { error } = await supabase
      .from('scoring_config')
      .insert({ activity_type: type, multiplier: val });

    if (!error) {
      setRows((prev) => [...prev, { activity_type: type, multiplier: val, editing: false, draft: String(val) }]
        .sort((a, b) => b.multiplier - a.multiplier));
      setNewType('');
      setNewMultiplier('');
    }
    setAdding(false);
  }

  async function deleteRow(type: string) {
    await supabase.from('scoring_config').delete().eq('activity_type', type);
    setRows((prev) => prev.filter((r) => r.activity_type !== type));
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color="#E91E8C" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>

        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.replace('/home')}>
            <Text style={styles.back}>← Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.title}>Scoring Config</Text>
        <Text style={styles.subtitle}>
          Changes apply to new activities only. Tap a multiplier to edit.
        </Text>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderText, { flex: 1 }]}>Activity</Text>
            <Text style={[styles.tableHeaderText, { width: 100, textAlign: 'right' }]}>Multiplier</Text>
          </View>

          {rows.map((row) => (
            <View key={row.activity_type} style={styles.tableRow}>
              <Text style={styles.activityType}>{row.activity_type}</Text>

              {row.editing ? (
                <View style={styles.editCell}>
                  <TextInput
                    style={styles.multiplierInput}
                    value={row.draft}
                    onChangeText={(v) => updateDraft(row.activity_type, v)}
                    keyboardType="decimal-pad"
                    autoFocus
                    selectTextOnFocus
                  />
                  <TouchableOpacity
                    onPress={() => saveRow(row.activity_type)}
                    style={styles.saveBtn}
                    disabled={saving === row.activity_type}
                  >
                    <Text style={styles.saveBtnText}>
                      {saving === row.activity_type ? '…' : '✓'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => cancelEdit(row.activity_type)}>
                    <Text style={styles.cancelText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.rowActions}>
                  <TouchableOpacity onPress={() => startEdit(row.activity_type)} style={styles.multiplierCell}>
                    <Text style={styles.multiplierValue}>×{row.multiplier}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteRow(row.activity_type)} style={styles.deleteBtn}>
                    <Text style={styles.deleteText}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Add new activity type */}
        <Text style={styles.addTitle}>Add Activity Type</Text>
        <View style={styles.addRow}>
          <TextInput
            style={styles.addTypeInput}
            placeholder="e.g. Pilates"
            placeholderTextColor="#666666"
            value={newType}
            onChangeText={setNewType}
            autoCapitalize="words"
          />
          <TextInput
            style={styles.addMultiplierInput}
            placeholder="×"
            placeholderTextColor="#666666"
            value={newMultiplier}
            onChangeText={setNewMultiplier}
            keyboardType="decimal-pad"
          />
          <TouchableOpacity
            style={[styles.addBtn, (!newType || !newMultiplier) && styles.addBtnDisabled]}
            onPress={addRow}
            disabled={adding || !newType || !newMultiplier}
          >
            <Text style={styles.addBtnText}>{adding ? '…' : '+ Add'}</Text>
          </TouchableOpacity>
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#999999',
    marginBottom: 28,
    lineHeight: 18,
  },
  table: {
    backgroundColor: '#111111',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#8DC63F',
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#8DC63F',
    backgroundColor: '#111111',
  },
  tableHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#666666',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d1a6e',
  },
  activityType: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  multiplierCell: {
    width: 100,
    alignItems: 'flex-end',
  },
  multiplierValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#E91E8C',
  },
  editCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  multiplierInput: {
    backgroundColor: '#111111',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: '#E91E8C',
    width: 64,
    textAlign: 'center',
  },
  saveBtn: {
    backgroundColor: '#E91E8C',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  cancelText: {
    color: '#999999',
    fontSize: 16,
    paddingHorizontal: 4,
  },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteBtn: {
    paddingHorizontal: 4,
  },
  deleteText: {
    fontSize: 16,
  },
  addTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 28,
    marginBottom: 12,
  },
  addRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  addTypeInput: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#8DC63F',
  },
  addMultiplierInput: {
    width: 64,
    backgroundColor: '#111111',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFFFFF',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#8DC63F',
    textAlign: 'center',
  },
  addBtn: {
    backgroundColor: '#E91E8C',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  addBtnDisabled: {
    opacity: 0.4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
