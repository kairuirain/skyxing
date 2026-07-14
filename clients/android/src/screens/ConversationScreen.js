import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';

export default function ConversationScreen({ route, navigation }) {
  const { convId } = route.params || {};
  const { user, api } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.getConversationMessages(convId);
      setMessages(d.messages || []);
    } catch (e) {
      Alert.alert('加载失败', e.message || '无法加载消息');
    } finally {
      setLoading(false);
    }
  }, [api, convId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await api.sendMessage(convId, text.trim());
      setText('');
      load();
    } catch (e) {
      Alert.alert('发送失败', e.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('删除会话', '确定删除该会话吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteConversation(convId);
            navigation.goBack();
          } catch (e) {
            Alert.alert('删除失败', e.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  const peerId = messages[0]
    ? (messages[0].fromId === user?.id ? messages[0].toId : messages[0].fromId)
    : '会话';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.back}>‹ 返回</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{peerId}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Text style={styles.delHeader}>删除</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.msgList} contentContainerStyle={styles.msgContent}>
        {messages.length === 0 && <Text style={styles.empty}>还没有消息，开始聊天吧</Text>}
        {messages.map((m) => {
          const mine = m.fromId === user?.id;
          return (
            <View key={m.id} style={[styles.bubbleRow, mine ? styles.rowRight : styles.rowLeft]}>
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, mine ? styles.textMine : styles.textOther]}>
                  {m.content}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="输入消息..."
          placeholderTextColor="#9ca3af"
          value={text}
          onChangeText={setText}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || submitting) && styles.disabled]}
          onPress={handleSend}
          disabled={!text.trim() || submitting}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendText}>发送</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    height: 52, backgroundColor: '#fff', borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#f3f4f6',
  },
  back: { fontSize: 16, color: '#2563eb', width: 56 },
  title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700', color: '#111827' },
  delHeader: { fontSize: 14, color: '#ef4444', width: 56, textAlign: 'right' },
  msgList: { flex: 1, backgroundColor: '#f9fafb' },
  msgContent: { paddingVertical: 12, paddingHorizontal: 12 },
  empty: { textAlign: 'center', marginTop: 40, fontSize: 14, color: '#d1d5db' },
  bubbleRow: { flexDirection: 'row', marginBottom: 8 },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9,
  },
  bubbleMine: { backgroundColor: '#2563eb', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  textMine: { color: '#fff' },
  textOther: { color: '#1f2937' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#f3f4f6',
  },
  input: {
    flex: 1, backgroundColor: '#f3f4f6', borderRadius: 18,
    paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: '#1f2937',
    maxHeight: 100, textAlignVertical: 'top',
  },
  sendBtn: {
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: '#2563eb',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.6 },
});
