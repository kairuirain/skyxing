import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text, View, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';

// 懒加载屏幕组件 - 优化首屏启动速度
import HomeScreen from '../screens/HomeScreen';
const PodcastScreen = React.lazy(() => import('../screens/PodcastScreen'));
const ProfileScreen = React.lazy(() => import('../screens/ProfileScreen'));
const ArticleScreen = React.lazy(() => import('../screens/ArticleScreen'));
const AdminScreen = React.lazy(() => import('../screens/AdminScreen'));
const MessagesScreen = React.lazy(() => import('../screens/MessagesScreen'));
const ConversationScreen = React.lazy(() => import('../screens/ConversationScreen'));

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// 底部 Tab 图标组件（无外部图标库依赖，减小包体积）
function TabIcon({ name, focused }) {
  const icons = {
    home: focused ? '🏠' : '🏡',
    podcast: focused ? '🎙️' : '🎧',
    profile: focused ? '👤' : '👥',
  };
  return (
    <Text style={{ fontSize: 22 }}>{icons[name] || '📄'}</Text>
  );
}

// 主页 Tab 导航器
function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => {
          const name = route.name === 'Home' ? 'home'
            : route.name === 'Podcast' ? 'podcast' : 'profile';
          return <TabIcon name={name} focused={focused} />;
        },
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#f3f4f6',
          height: 56,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        lazy: true, // 懒加载 Tab 页面
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ tabBarLabel: '主页' }}
      />
      <Tab.Screen
        name="Podcast"
        options={{ tabBarLabel: '播客' }}
      >
        {() => (
          <React.Suspense fallback={
            <View style={styles.loading}><Text>加载中...</Text></View>
          }>
            <PodcastScreen />
          </React.Suspense>
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{ tabBarLabel: '我的' }}
      >
        {() => (
          <React.Suspense fallback={
            <View style={styles.loading}><Text>加载中...</Text></View>
          }>
            <ProfileScreen />
          </React.Suspense>
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

// 根导航器
export default function AppNavigator() {
  const { loading } = useAuth();
  const { loaded } = useSettings();

  if (loading || !loaded) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>SkyXing</Text>
        <Text style={styles.splashSubtitle}>博客平台</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#111827',
          headerTitleStyle: { fontWeight: '600', fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#f9fafb' },
        }}
      >
        <Stack.Screen
          name="Main"
          component={HomeTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Article"
          options={({ route }) => ({ title: route.params?.title || '文章详情' })}
        >
          {(props) => (
            <React.Suspense fallback={
              <View style={styles.loading}><Text>加载中...</Text></View>
            }>
              <ArticleScreen {...props} />
            </React.Suspense>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Admin"
          options={{ title: '管理后台' }}
        >
          {() => (
            <React.Suspense fallback={
              <View style={styles.loading}><Text>加载中...</Text></View>
            }>
              <AdminScreen />
            </React.Suspense>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Messages"
          options={{ title: '私信' }}
        >
          {() => (
            <React.Suspense fallback={
              <View style={styles.loading}><Text>加载中...</Text></View>
            }>
              <MessagesScreen />
            </React.Suspense>
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Conversation"
          options={({ route }) => ({ title: route.params?.title || '会话' })}
        >
          {(props) => (
            <React.Suspense fallback={
              <View style={styles.loading}><Text>加载中...</Text></View>
            }>
              <ConversationScreen {...props} />
            </React.Suspense>
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
  splashTitle: { fontSize: 32, fontWeight: '800', color: '#2563eb' },
  splashSubtitle: { fontSize: 16, color: '#60a5fa', marginTop: 8 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
