import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { extractExcerpt, formatRelativeTime } from '../../shared/sanitize';

// 播客列表项（复用文章数据作为播客）
const PodcastItem = React.memo(({ article, onPress }) => (
  <TouchableOpacity style={styles.card} onPress={() => onPress(article)} activeOpacity={0.7}>
    <View style={styles.cardInner}>
      {/* 左侧封面 */}
      <View style={styles.thumbnail}>
        <Text style={styles.thumbnailIcon}>🎙️</Text>
      </View>
      {/* 右侧信息 */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{article.title}</Text>
        <Text style={styles.cardExcerpt} numberOfLines={1}>
          {article.excerpt || extractExcerpt(article.content, 60)}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={styles.metaText}>{article.authorName || '匿名'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatRelativeTime(article.createdAt)}</Text>
        </View>
        <View style={styles.audioBar}>
          <View style={[styles.audioDot, { backgroundColor: '#2563eb' }]} />
          <View style={[styles.audioDot, { backgroundColor: '#60a5fa' }]} />
          <View style={[styles.audioDot, { backgroundColor: '#93c5fd' }]} />
          <Text style={styles.audioDuration}>12:34</Text>
        </View>
      </View>
    </View>
  </TouchableOpacity>
));

export default function PodcastScreen({ navigation }) {
  const { api } = useAuth();
  const [podcasts, setPodcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 复用文章 API 数据模拟播客内容
  const fetchPodcasts = useCallback(async () => {
    try {
      const data = await api.getArticles({ limit: 20 });
      // 筛选有标签的文章模拟播客节目
      const withTags = (data.articles || []).filter(a => a.tags && a.tags.length > 0);
      setPodcasts(withTags.length > 0 ? withTags : data.articles || []);
    } catch (err) {
      console.error('Failed to fetch podcasts:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api]);

  useEffect(() => { fetchPodcasts(); }, [fetchPodcasts]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchPodcasts();
  };

  const handlePress = (article) => {
    navigation.navigate('Article', { id: article.id, title: article.title });
  };

  const renderItem = useCallback(({ item }) => (
    <PodcastItem article={item} onPress={handlePress} />
  ), []);

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 播客头部 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>播客</Text>
        <Text style={styles.headerSubtitle}>
          发现精彩内容 · 随时随地收听
        </Text>
      </View>

      <FlatList
        data={podcasts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#2563eb']} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎧</Text>
            <Text style={styles.emptyText}>暂无播客内容</Text>
          </View>
        }
        removeClippedSubviews={true}
        maxToRenderPerBatch={8}
        windowSize={5}
        initialNumToRender={8}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: {
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  list: { paddingVertical: 8 },
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardInner: { flexDirection: 'row', padding: 12 },
  thumbnail: {
    width: 72, height: 72, borderRadius: 12,
    backgroundColor: '#eff6ff', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  thumbnailIcon: { fontSize: 28 },
  cardInfo: { flex: 1, justifyContent: 'space-between' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 21, marginBottom: 4 },
  cardExcerpt: { fontSize: 13, color: '#6b7280', marginBottom: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  metaText: { fontSize: 12, color: '#9ca3af' },
  metaDot: { marginHorizontal: 6, color: '#d1d5db' },
  audioBar: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  audioDot: { width: 3, height: 12, borderRadius: 2 },
  audioDuration: { fontSize: 11, color: '#9ca3af', marginLeft: 8 },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#9ca3af' },
});
