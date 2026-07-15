import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, useWindowDimensions,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { sanitizeHTML, formatRelativeTime } from '../../shared/sanitize';
import { useSettings } from '../context/SettingsContext';
// 置顶指示器使用纯文本，避免引入 lucide-react（React Native 依赖管理不同）

// 懒加载评论列表
const CommentList = React.lazy(() => Promise.resolve({ default: CommentListView }));

function CommentListView({ comments, user, onDelete, onPin, isArticleAuthor }) {
  // 构建评论树
  const commentTree = React.useMemo(() => {
    const map = {};
    const roots = [];
    comments.forEach(c => { map[c.id] = { ...c, replies: [] }; });
    comments.forEach(c => {
      if (c.parentId && map[c.parentId]) {
        map[c.parentId].replies.push(map[c.id]);
      } else {
        roots.push(map[c.id]);
      }
    });
    return roots;
  }, [comments]);

  return (
    <View style={commentStyles.container}>
      {commentTree.map(comment => (
        <CommentItem
          key={comment.id}
          comment={comment}
          user={user}
          onDelete={onDelete}
          onPin={onPin}
          isArticleAuthor={isArticleAuthor}
        />
      ))}
    </View>
  );
}

function CommentItem({ comment, user, onDelete, onPin, isArticleAuthor }) {
  const canDelete = user && (user.id === comment.userId || user.role === 'admin');

  return (
    <View style={[commentStyles.item, comment.pinned && { backgroundColor: '#eff6ff', borderLeftWidth: 3, borderLeftColor: '#2563eb', marginLeft: -14, paddingLeft: 17 }]}>
      <View style={commentStyles.itemHeader}>
        <View style={commentStyles.avatarSmall}>
          <Text style={commentStyles.avatarSmallText}>
            {(comment.userDisplayName || comment.username || '?').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={commentStyles.itemMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Text style={commentStyles.itemAuthor}>
              {comment.userDisplayName || comment.username || '匿名'}
            </Text>
            {comment.pinned && (
              <Text style={{ fontSize: 11, color: '#2563eb', fontWeight: '600' }}>📌 置顶</Text>
            )}
          </View>
          <Text style={commentStyles.itemTime}>
            {formatRelativeTime(comment.createdAt)}
          </Text>
        </View>
        {isArticleAuthor && (
          <TouchableOpacity onPress={() => onPin(comment.id)} style={commentStyles.deleteBtn}>
            <Text style={{ fontSize: 12, color: '#2563eb' }}>{comment.pinned ? '取消' : '置顶'}</Text>
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity onPress={() => onDelete(comment.id)} style={commentStyles.deleteBtn}>
            <Text style={commentStyles.deleteBtnText}>删除</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={commentStyles.itemContent}>{comment.content}</Text>
      {comment.replies && comment.replies.length > 0 && (
        <View style={commentStyles.replies}>
          {comment.replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              user={user}
              onDelete={onDelete}
              onPin={onPin}
              isArticleAuthor={isArticleAuthor}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const commentStyles = StyleSheet.create({
  container: { marginTop: 8 },
  item: {
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  itemHeader: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 6,
  },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: '#2563eb', justifyContent: 'center', alignItems: 'center',
    marginRight: 8,
  },
  avatarSmallText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  itemMeta: { flex: 1 },
  itemAuthor: { fontSize: 13, fontWeight: '600', color: '#374151' },
  itemTime: { fontSize: 11, color: '#9ca3af' },
  itemContent: { fontSize: 14, color: '#374151', lineHeight: 20, marginLeft: 36 },
  deleteBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  deleteBtnText: { fontSize: 12, color: '#ef4444' },
  replies: { marginLeft: 36, borderLeftWidth: 2, borderLeftColor: '#f3f4f6' },
});

// 按需渲染的文章内容组件
const ArticleContent = React.memo(({ html, fontSize }) => {
  const sanitized = React.useMemo(() => sanitizeHTML(html), [html]);
  const fontSizeMap = { small: 14, medium: 16, large: 18 };
  const baseSize = fontSizeMap[fontSize] || 16;

  // 简单解析 HTML 为 React Native 可渲染结构
  const parseSimpleHTML = (raw) => {
    const text = raw.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text;
  };

  return (
    <View style={{ paddingHorizontal: 14 }}>
      <Text style={{ fontSize: baseSize, color: '#374151', lineHeight: baseSize * 1.75 }}>
        {parseSimpleHTML(sanitized)}
      </Text>
    </View>
  );
});

export default function ArticleScreen({ route, navigation }) {
  const { id } = route.params || {};
  const { user, api } = useAuth();
  const { settings } = useSettings();

  const [article, setArticle] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchArticle = useCallback(async () => {
    try {
      const data = await api.getArticle(id);
      setArticle(data.article);
    } catch (err) {
      Alert.alert('加载失败', err.message || '无法加载文章');
    }
  }, [api, id]);

  const fetchComments = useCallback(async () => {
    try {
      const data = await api.getComments(id);
      setComments(data.comments || []);
    } catch { /* ignore */ }
  }, [api, id]);

  useEffect(() => {
    if (!id) {
      // 写文章模式
      navigation.setOptions({ title: '写文章' });
      setLoading(false);
      return;
    }
    Promise.all([fetchArticle(), fetchComments()]).finally(() => setLoading(false));
  }, [id, fetchArticle, fetchComments]);

  const submitComment = async () => {
    if (!commentText.trim()) return;
    if (!user) {
      Alert.alert('提示', '请先登录后再评论');
      return;
    }
    setSubmitting(true);
    try {
      await api.createComment({ articleId: id, content: commentText.trim() });
      setCommentText('');
      fetchComments();
    } catch (err) {
      Alert.alert('评论失败', err.message || '请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteComment = async (commentId) => {
    Alert.alert('删除评论', '确定要删除这条评论吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteComment(commentId);
            fetchComments();
          } catch (err) {
            Alert.alert('删除失败', err.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  const deleteArticle = () => {
    Alert.alert('删除文章', '确定要删除这篇文章吗？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteArticle(id);
            navigation.goBack();
          } catch (err) {
            Alert.alert('删除失败', err.message || '请稍后重试');
          }
        },
      },
    ]);
  };

  const pinArticle = async () => {
    try {
      const data = await api.pinArticle(id);
      setArticle(prev => ({ ...prev, pinned: data.article.pinned }));
    } catch (err) {
      Alert.alert('操作失败', err.message || '请稍后重试');
    }
  };

  const pinComment = async (commentId) => {
    try {
      await api.pinComment(commentId);
      fetchComments();
    } catch (err) {
      Alert.alert('操作失败', err.message || '请稍后重试');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  if (!article) {
    return (
      <View style={styles.center}>
        <Text style={styles.notFoundText}>文章不存在或已删除</Text>
      </View>
    );
  }

  const isOwner = user && (user.id === article.authorId || user.role === 'admin');
  const isArticleAuthor = user && user.id === article.authorId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      {/* 文章头部 */}
      <View style={styles.articleHeader}>
        <Text style={styles.articleTitle}>{article.title}</Text>
        <View style={styles.articleMeta}>
          <Text style={styles.metaText}>{article.authorName || '匿名'}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{formatRelativeTime(article.createdAt)}</Text>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>{article.views || 0} 阅读</Text>
        </View>
        {article.tags && article.tags.length > 0 && (
          <View style={styles.tagRow}>
            {article.tags.map((tag, i) => (
              <View key={i} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        {isOwner && (
          <View style={styles.ownerActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => navigation.navigate('EditArticle', { id })}
            >
              <Text style={styles.actionBtnText}>编辑</Text>
            </TouchableOpacity>
            {user?.role === 'admin' && (
              <TouchableOpacity style={styles.actionBtn} onPress={pinArticle}>
                <Text style={styles.actionBtnText}>{article.pinned ? '取消置顶' : '置顶'}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.actionBtn, styles.deleteAction]} onPress={deleteArticle}>
              <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>删除</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 封面图 */}
      {article.coverImage ? (
        <View style={styles.coverContainer}>
          <Image source={{ uri: article.coverImage }} style={styles.coverImage} resizeMode="cover" />
        </View>
      ) : null}

      {/* 文章内容 */}
      <ArticleContent html={article.content} fontSize={settings.fontSize} />

      {/* 评论区域 */}
      <View style={styles.commentSection}>
        <Text style={styles.commentTitle}>
          评论 ({comments.length})
        </Text>

        {/* 评论输入 */}
        {user ? (
          <View style={styles.commentInputRow}>
            <TextInput
              style={styles.commentInput}
              placeholder="写下你的评论..."
              placeholderTextColor="#9ca3af"
              value={commentText}
              onChangeText={setCommentText}
              multiline
              numberOfLines={3}
            />
            <TouchableOpacity
              style={[styles.commentSubmit, (!commentText.trim() || submitting) && styles.btnDisabled]}
              onPress={submitComment}
              disabled={!commentText.trim() || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.commentSubmitText}>发布</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={styles.loginHint}>登录后参与评论</Text>
        )}

        {/* 评论列表 - 懒加载 */}
        {comments.length > 0 ? (
          <React.Suspense fallback={<ActivityIndicator size="small" color="#2563eb" style={{ marginTop: 16 }} />}>
            <CommentList comments={comments} user={user} onDelete={deleteComment} onPin={pinComment} isArticleAuthor={isArticleAuthor} />
          </React.Suspense>
        ) : (
          <Text style={styles.noComments}>暂无评论，来说点什么吧</Text>
        )}
      </View>
    </ScrollView>
  );
}

import { Image } from 'react-native';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollContent: { paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  notFoundText: { fontSize: 16, color: '#9ca3af' },
  articleHeader: {
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f3f4f6',
  },
  articleTitle: { fontSize: 22, fontWeight: '800', color: '#111827', lineHeight: 30, marginBottom: 10 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  metaText: { fontSize: 13, color: '#9ca3af' },
  metaDot: { marginHorizontal: 6, color: '#d1d5db' },
  tagRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  tag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, backgroundColor: '#eff6ff' },
  tagText: { fontSize: 12, color: '#2563eb' },
  ownerActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  actionBtn: {
    paddingHorizontal: 14, paddingVertical: 6,
    borderRadius: 6, backgroundColor: '#f3f4f6',
  },
  actionBtnText: { fontSize: 13, color: '#374151' },
  deleteAction: { backgroundColor: '#fef2f2' },
  coverContainer: { width: '100%', height: 200, backgroundColor: '#f3f4f6' },
  coverImage: { width: '100%', height: '100%' },
  commentSection: { paddingHorizontal: 16, paddingTop: 24 },
  commentTitle: { fontSize: 17, fontWeight: '700', color: '#111827', marginBottom: 16 },
  commentInputRow: { marginBottom: 16 },
  commentInput: {
    backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: '#1f2937', minHeight: 80, textAlignVertical: 'top',
  },
  commentSubmit: {
    alignSelf: 'flex-end', marginTop: 8,
    paddingHorizontal: 20, paddingVertical: 8,
    borderRadius: 8, backgroundColor: '#2563eb',
  },
  commentSubmitText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  btnDisabled: { opacity: 0.6 },
  loginHint: {
    textAlign: 'center', paddingVertical: 24,
    fontSize: 14, color: '#9ca3af',
  },
  noComments: {
    textAlign: 'center', paddingVertical: 24,
    fontSize: 14, color: '#d1d5db',
  },
});
