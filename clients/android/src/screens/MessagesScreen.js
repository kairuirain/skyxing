import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, FlatList,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function MessagesScreen({ navigation }) {
  const { user, api } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState('');
  const [starting, setStarting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.getConversations();
      setConversations(d.conversations || []);
    } catch (e) {
      Alert.alert('加载失败', e.message || '无法加载会话');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    if (user) load();
    else setLoading(false);
  }, [user, load]);

  const handleStart = async () => {
    if (!target.trim()) return;
    setStarting(true);
    try {
      const d = await api.startConversation(target.trim());
      navigation.navigate('Conversation', { convId: d.conversation.id });
    } catch (e) {
      Alert.alert('发起失败', e.message || '请稍后重试');
    } finally {
      setStarting(false);
    }
  };

  const handleDelete = (convId) => {
    Alert.alert('删除会话', '确定删除该会话吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteConversation(convId);
            setConversations((list) => list.filter((c) => c.id !== convId));
          } catch (e) {
            Alert.alert('删除失败', e.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.hint}>请先登录后查看私信</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>私信</Text>
      </View>

      <View style={styles.startRow}>
        <TextInput
          style={styles.startInput}
          placeholder="输入对方用户名发起新私信"
          placeholderTextColor="#9ca3af"
          value={target}
          onChangeText={setTarget}
          autoCapitalize="none"
        />
        <TouchableOpacity
          style={[styles.startBtn, (!target.trim() || starting) && styles.disabled]}
          onPress={handleStart}
          disabled={!target.trim() || starting}
        >
          <Text style={styles.startBtnText}>发起</Text>
        </TouchableOpacity>
      </View>

      {conversations.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.hint}>还没有会话，发起第一条私信吧</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <View style={styles.convItem}>
              <TouchableOpacity
                style={styles.convMain}
                onPress={() => navigation.navigate('Conversation', { convId: item.id })}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {(item.otherUser?.displayName || '?').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.convMeta}>
                  <View style={styles.convTop}>
                    <Text style={styles.convName}>
                      {item.otherUser?.displayName || item.otherUser?.username}
                    </Text>
                    {item.unreadCount > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.unreadCount}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.convLast} numberOfLines={1}>
                    {item.lastMessage || '（无消息）'}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity style={styles.delBtn} onPress={() => handleDelete(item.id)}>
                <Text style={styles.delText}>删除</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12,
    backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#111827' },
  startRow: {
    flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff',
  },
  startInput: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: '#1f2937',
  },
  startBtn: {
    paddingHorizontal: 18, justifyContent: 'center', borderRadius: 10, backgroundColor: '#2563eb',
  },
  startBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.6 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  hint: { fontSize: 14, color: '#9ca3af' },
  convItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  convMain: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#2563eb',
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  avatarText: { color: '#fff', fontWeight: '700' },
  convMeta: { flex: 1, minWidth: 0 },
  convTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  badge: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 9,
    backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center',
  },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  convLast: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  delBtn: { paddingHorizontal: 16 },
  delText: { fontSize: 13, color: '#ef4444' },
});
