import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  StyleSheet, RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { extractExcerpt, formatRelativeTime } from '../../shared/sanitize';
import { useSettings } from '../context/SettingsContext';
import useSync from '../hooks/useSync';

const { width } = Dimensions.get('window');

// 懒加载：文章卡片组件按需渲染
const ArticleCard = React.memo(({ article, onPress, fontSize }) => {
  const excerpt = article.excerpt || extractExcerpt(article.content, 120);
  const fontSizeMap = { small: 13, medium: 15, large: 17 };
  const baseSize = fontSizeMap[fontSize] || 15;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(article)}
      activeOpacity={0.7}
    >
      {article.coverImage ? (
        <View style={styles.coverContainer}>
          <FastImage
            source={{ uri: article.coverImage }}
            style={styles.coverImage}
            resizeMode="cover"
          />
        </View>
      ) : null}
      <View style={styles.cardBody}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          {article.pinned && (
            <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: '#dbeafe' }}>
              <Text style={{ fontSize: 10, color: '#1d4ed8', fontWeight: '700' }}>📌 置顶</Text>
            </View>
          )}
          <Text style={[styles.cardTitle, { fontSize: baseSize + 2 }]} numberOfLines={2}>
            {article.title}
          </Text>
        </View>
        <Text style={[styles.cardExcerpt, { fontSize: baseSize - 1 }]} numberOfLines={2}>
          {excerpt}
        </Text>
        <View style={styles.cardMeta}>
          <Text style={[styles.metaText, { fontSize: baseSize - 3 }]}>
            {article.authorName || '匿名'}
          </Text>
          <Text style={[styles.metaDot, { fontSize: baseSize - 3 }]}>·</Text>
          <Text style={[styles.metaText, { fontSize: baseSize - 3 }]}>
            {formatRelativeTime(article.createdAt)}
          </Text>
          <Text style={[styles.metaDot, { fontSize: baseSize - 3 }]}>·</Text>
          <Text style={[styles.metaText, { fontSize: baseSize - 3 }]}>
            {article.views || 0} 阅读
          </Text>
        </View>
        {article.tags && article.tags.length > 0 && (
          <View style={styles.tagRow}>
            {article.tags.slice(0, 3).map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

// 简易图片组件，无外部依赖
const FastImage = ({ source, style, resizeMode }) => {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  return (
    <View style={[style, { backgroundColor: '#f3f4f6', overflow: 'hidden' }]}>
      {error ? (
        <View style={styles.imagePlaceholder}>
          <Text style={{ color: '#9ca3af' }}>图片加载失败</Text>
        </View>
      ) : (
        <Image
          source={source}
          style={{ width: '100%', height: '100%' }}
          resizeMode={resizeMode}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
        />
      )}
    </View>
  );
};

import { Image } from 'react-native';

// 标签筛选芯片
const TagChip = React.memo(({ tag, selected, onPress }) => (
  <TouchableOpacity
    style={[styles.chip, selected && styles.chipSelected]}
    onPress={() => onPress(tag === selected ? null : tag)}
    activeOpacity={0.7}
  >
    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
      {tag}
    </Text>
  </TouchableOpacity>
));

export default function HomeScreen({ navigation }) {
  const { api } = useAuth();
  const { settings } = useSettings();
  const [articles, setArticles] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, hasMore: false });
  const [tags, setTags] = useState([]);
  const [selectedTag, setSelectedTag] = useState(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchArticles = useCallback(async (page = 1, append = false) => {
    try {
      const params = { page, limit: 10 };
      if (selectedTag) params.tag = selectedTag;
      if (search.trim()) params.search = search.trim();

      const data = await api.getArticles(params);
      if (append) {
        setArticles(prev => [...prev, ...data.articles]);
      } else {
        setArticles(data.articles);
      }
      setPagination(data.pagination);
    } catch (err) {
      console.error('Failed to fetch articles:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [api, selectedTag, search]);

  const fetchTags = useCallback(async () => {
    try {
      const data = await api.getTags();
      setTags(data.tags || []);
    } catch { /* ignore */ }
  }, [api]);

  useEffect(() => {
    setLoading(true);
    fetchArticles(1);
    fetchTags();
  }, [fetchArticles, fetchTags]);

  useSync(api, () => fetchArticles(1), { enabled: !selectedTag && !search.trim() });

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchArticles(1);
  }, [fetchArticles]);

  const onEndReached = useCallback(() => {
    if (loadingMore || !pagination.hasMore) return;
    setLoadingMore(true);
    fetchArticles(pagination.page + 1, true);
  }, [loadingMore, pagination, fetchArticles]);

  const onSearchSubmit = () => {
    setLoading(true);
    fetchArticles(1);
  };

  const handleArticlePress = (article) => {
    navigation.navigate('Article', { id: article.id, title: article.title });
  };

  const renderItem = useCallback(({ item }) => (
    <ArticleCard
      article={item}
      onPress={handleArticlePress}
      fontSize={settings.fontSize}
    />
  ), [settings.fontSize]);

  const ListHeaderComponent = useCallback(() => (
    <View>
      {/* 搜索栏 */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="搜索文章..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={onSearchSubmit}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity
            style={styles.searchClear}
            onPress={() => { setSearch(''); }}
          >
            <Text style={styles.searchClearText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 标签筛选 */}
      {tags.length > 0 && (
        <View style={styles.chipContainer}>
          <TagChip tag="全部" selected={!selectedTag} onPress={() => setSelectedTag(null)} />
          {tags.map(tag => (
            <TagChip
              key={tag}
              tag={tag}
              selected={selectedTag === tag}
              onPress={setSelectedTag}
            />
          ))}
        </View>
      )}
    </View>
  ), [search, tags, selectedTag]);

  const ListFooterComponent = useCallback(() => {
    if (loadingMore) {
      return (
        <View style={styles.footerLoader}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.footerText}>加载更多...</Text>
        </View>
      );
    }
    if (!pagination.hasMore && articles.length > 0) {
      return <Text style={styles.footerText}>— 已经到底了 —</Text>;
    }
    return null;
  }, [loadingMore, pagination.hasMore, articles.length]);

  if (loading && !refreshing) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={ListHeaderComponent}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📝</Text>
              <Text style={styles.emptyText}>还没有文章</Text>
              <Text style={styles.emptySubtext}>快来写第一篇吧！</Text>
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#2563eb']}
            tintColor="#2563eb"
          />
        }
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        removeClippedSubviews={true}
        maxToRenderPerBatch={5}
        windowSize={7}
        initialNumToRender={5}
        getItemLayout={(_, index) => ({
          length: 180,
          offset: 180 * index,
          index,
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  listContent: { paddingBottom: 20 },
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: '#fff',
    borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: '#1f2937',
  },
  searchClear: {
    paddingHorizontal: 14, paddingVertical: 12,
  },
  searchClearText: {
    fontSize: 14, color: '#9ca3af',
  },
  chipContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, paddingBottom: 8, gap: 8,
  },
  chip: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 20, backgroundColor: '#f3f4f6',
  },
  chipSelected: {
    backgroundColor: '#2563eb',
  },
  chipText: {
    fontSize: 13, color: '#6b7280',
  },
  chipTextSelected: {
    color: '#fff',
  },
  card: {
    backgroundColor: '#fff', marginHorizontal: 12, marginVertical: 6,
    borderRadius: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  coverContainer: { width: '100%', height: 160 },
  coverImage: { width: '100%', height: '100%' },
  cardBody: { padding: 14 },
  cardTitle: { fontWeight: '700', color: '#111827', marginBottom: 6, lineHeight: 22 },
  cardExcerpt: { color: '#6b7280', lineHeight: 20, marginBottom: 10 },
  cardMeta: { flexDirection: 'row', alignItems: 'center' },
  metaText: { color: '#9ca3af' },
  metaDot: { marginHorizontal: 6, color: '#d1d5db' },
  tagRow: { flexDirection: 'row', marginTop: 8, gap: 6 },
  tag: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 4, backgroundColor: '#eff6ff',
  },
  tagText: { fontSize: 11, color: '#2563eb' },
  imagePlaceholder: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#f3f4f6',
  },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 17, color: '#6b7280', fontWeight: '600' },
  emptySubtext: { fontSize: 14, color: '#9ca3af', marginTop: 4 },
  footerLoader: {
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
    paddingVertical: 16, gap: 8,
  },
  footerText: {
    textAlign: 'center', paddingVertical: 16,
    fontSize: 13, color: '#9ca3af',
  },
});
