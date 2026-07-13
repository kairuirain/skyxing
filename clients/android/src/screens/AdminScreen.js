import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { formatRelativeTime } from '../../shared/sanitize';

const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'users', label: '用户管理' },
  { key: 'articles', label: '文章管理' },
];

export default function AdminScreen() {
  const { user, api } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [statsData, usersData, articlesData] = await Promise.all([
        api.getStats(),
        api.getAdminUsers(),
        api.getAdminArticles(),
      ]);
      setStats(statsData);
      setUsers(usersData.users || []);
      setArticles(articlesData.articles || []);
    } catch (err) {
      Alert.alert('加载失败', err.message || '无法加载管理数据');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (user?.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Text style={styles.forbiddenText}>无权访问管理后台</Text>
      </View>
    );
  }

  const handleRoleChange = (targetUser, newRole) => {
    Alert.alert(
      '修改角色',
      `将 ${targetUser.username} 的角色修改为 "${newRole}"？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          onPress: async () => {
            try {
              await api.updateUserRole(targetUser.id, newRole);
              fetchData();
            } catch (err) {
              Alert.alert('修改失败', err.message || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const handleDeleteUser = (targetUser) => {
    if (targetUser.id === user.id) {
      Alert.alert('提示', '不能删除自己');
      return;
    }
    Alert.alert(
      '删除用户',
      `确定要删除用户 "${targetUser.username}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteUser(targetUser.id);
              fetchData();
            } catch (err) {
              Alert.alert('删除失败', err.message || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  const handleDeleteArticle = (article) => {
    Alert.alert(
      '删除文章',
      `确定要删除 "${article.title}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除', style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteArticle(article.id);
              fetchData();
            } catch (err) {
              Alert.alert('删除失败', err.message || '请稍后重试');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Tab 导航 */}
      <View style={styles.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 概览 */}
      {activeTab === 'overview' && stats && (
        <View style={styles.tabContent}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalUsers || 0}</Text>
              <Text style={styles.statLabel}>用户数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalArticles || 0}</Text>
              <Text style={styles.statLabel}>文章数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalComments || 0}</Text>
              <Text style={styles.statLabel}>评论数</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{stats.totalViews || 0}</Text>
              <Text style={styles.statLabel}>总阅读量</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>已发布: {stats.publishedArticles || 0}</Text>
            <Text style={styles.statRowLabel}>草稿: {stats.draftArticles || 0}</Text>
          </View>
        </View>
      )}

      {/* 用户管理 */}
      {activeTab === 'users' && (
        <View style={styles.tabContent}>
          {users.map(u => (
            <View key={u.id} style={styles.listItem}>
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemName}>{u.displayName || u.username}</Text>
                <Text style={styles.listItemSub}>@{u.username} · {u.email}</Text>
                <Text style={styles.listItemSub}>角色: {u.role}</Text>
              </View>
              <View style={styles.listItemActions}>
                <TouchableOpacity
                  style={styles.smallBtn}
                  onPress={() => {
                    Alert.alert('选择角色', '', [
                      { text: 'user', onPress: () => handleRoleChange(u, 'user') },
                      { text: 'author', onPress: () => handleRoleChange(u, 'author') },
                      { text: 'admin', onPress: () => handleRoleChange(u, 'admin') },
                      { text: '取消', style: 'cancel' },
                    ]);
                  }}
                >
                  <Text style={styles.smallBtnText}>改角色</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.smallBtn, styles.dangerBtn]}
                  onPress={() => handleDeleteUser(u)}
                >
                  <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 文章管理 */}
      {activeTab === 'articles' && (
        <View style={styles.tabContent}>
          {articles.map(a => (
            <View key={a.id} style={styles.listItem}>
              <View style={styles.listItemInfo}>
                <Text style={styles.listItemName} numberOfLines={1}>{a.title}</Text>
                <Text style={styles.listItemSub}>
                  {a.authorName || '未知'} · {formatRelativeTime(a.createdAt)}
                  {a.status === 'draft' ? ' · [草稿]' : ''}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.smallBtn, styles.dangerBtn]}
                onPress={() => handleDeleteArticle(a)}
              >
                <Text style={[styles.smallBtnText, { color: '#dc2626' }]}>删除</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  forbiddenText: { fontSize: 16, color: '#9ca3af' },
  tabBar: {
    flexDirection: 'row', backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  tab: {
    flex: 1, paddingVertical: 14, alignItems: 'center',
    borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: '#2563eb' },
  tabText: { fontSize: 14, color: '#6b7280', fontWeight: '500' },
  tabTextActive: { color: '#2563eb', fontWeight: '600' },
  tabContent: { padding: 12 },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: '#fff',
    borderRadius: 10, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2, elevation: 1,
  },
  statNumber: { fontSize: 28, fontWeight: '800', color: '#2563eb' },
  statLabel: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  statRow: {
    flexDirection: 'row', gap: 16, paddingHorizontal: 4,
  },
  statRowLabel: { fontSize: 14, color: '#6b7280' },
  listItem: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 10, padding: 14,
    marginBottom: 8,
  },
  listItemInfo: { flex: 1 },
  listItemName: { fontSize: 15, fontWeight: '600', color: '#111827' },
  listItemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  listItemActions: { flexDirection: 'row', gap: 6 },
  smallBtn: {
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 6, backgroundColor: '#f3f4f6',
  },
  smallBtnText: { fontSize: 12, color: '#374151' },
  dangerBtn: { backgroundColor: '#fef2f2' },
});
