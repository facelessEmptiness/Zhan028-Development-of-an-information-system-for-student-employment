import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';
import NotificationBell from '../components/NotificationBell';

import JobsScreen               from '../screens/JobsScreen';
import JobDetailScreen          from '../screens/JobDetailScreen';
import ApplicationsScreen       from '../screens/ApplicationsScreen';
import NotificationsScreen      from '../screens/NotificationsScreen';
import ProfileScreen            from '../screens/ProfileScreen';
import EmploymentScreen         from '../screens/EmploymentScreen';
import StudentProfileEditScreen from '../screens/StudentProfileEditScreen';
import DocumentsScreen          from '../screens/DocumentsScreen';
import InterviewsScreen         from '../screens/InterviewsScreen';
import ChatScreen               from '../screens/ChatScreen';
import ChatsListScreen          from '../screens/ChatsListScreen';
import EmployerChatsListScreen  from '../screens/EmployerChatsListScreen';
import StudentHomeScreen        from '../screens/StudentHomeScreen';

import EmployerVacanciesScreen      from '../screens/EmployerVacanciesScreen';
import EmployerVacancyFormScreen    from '../screens/EmployerVacancyFormScreen';
import EmployerApplicationsScreen   from '../screens/EmployerApplicationsScreen';
import EmployerCompanyProfileScreen from '../screens/EmployerCompanyProfileScreen';
import EmployerInterviewsScreen     from '../screens/EmployerInterviewsScreen';
import CandidateDetailScreen        from '../screens/CandidateDetailScreen';

import UniversityAnalyticsScreen from '../screens/UniversityAnalyticsScreen';
import UniversityStudentsScreen  from '../screens/UniversityStudentsScreen';

import type { Vacancy } from '../services/jobService';

// ─── Param lists ────────────────────────────────────────────────
export type HomeStackParamList = {
  HomeMain:   undefined;
  JobDetail:  { vacancy: Vacancy };
  Documents:  undefined;
  Employment: undefined;
};

export type StudentStackParamList = {
  JobsMain:   undefined;
  JobDetail:  { vacancy: Vacancy };
  Chat:       { applicationId: string; title: string };
};

export type AppsStackParamList = {
  AppsList:       undefined;
  InterviewsList: undefined;
  Chat:           { applicationId: string; title: string };
};

export type EmployerStackParamList = {
  VacanciesList:       undefined;
  VacancyForm:         { vacancy?: Vacancy };
  VacancyApplications: { vacancyId: string; vacancyTitle: string };
  CandidateDetail:     { studentId: string; applicationId?: string };
  EmployerChat:        { applicationId: string; title: string };
};

export type ChatsStackParamList = {
  ChatsList: undefined;
  Chat:      { applicationId: string; title: string };
};

export type EmployerChatsStackParamList = {
  EmployerChatsList: undefined;
  EmployerChat:      { applicationId: string; title: string };
};

export type EmployerAppsStackParamList = {
  EmployerAppsList: undefined;
  InterviewsList:   undefined;
};

export type UniversityStackParamList = {
  AnalyticsDash: undefined;
  StudentsList:  undefined;
};

export type RootStackParamList = {
  MainTabs:      undefined;
  Notifications: undefined;
};

// ─── Stack navigators ────────────────────────────────────────────
const RootStack       = createNativeStackNavigator<RootStackParamList>();
const Tab             = createBottomTabNavigator();
const HomeStack       = createNativeStackNavigator<HomeStackParamList>();
const JobsStack       = createNativeStackNavigator<StudentStackParamList>();
const AppsStack       = createNativeStackNavigator<AppsStackParamList>();
const ChatsStack      = createNativeStackNavigator<ChatsStackParamList>();
const EmpStack        = createNativeStackNavigator<EmployerStackParamList>();
const EmpChatsStack   = createNativeStackNavigator<EmployerChatsStackParamList>();
const UniStack        = createNativeStackNavigator<UniversityStackParamList>();

const HEADER_OPTS = {
  headerStyle:      { backgroundColor: '#fff' },
  headerTitleStyle: { fontWeight: '700' as const },
};

const HEADER_BELL = { headerRight: () => <NotificationBell /> };

// ─── Student stacks ──────────────────────────────────────────────
function HomeStackNav() {
  const { t } = useTranslation();
  return (
    <HomeStack.Navigator screenOptions={HEADER_OPTS}>
      <HomeStack.Screen name="HomeMain"   component={StudentHomeScreen} options={{ title: t('screen.home'),      ...HEADER_BELL }} />
      <HomeStack.Screen name="JobDetail"  component={JobDetailScreen}   options={{ title: t('screen.vacancy') }} />
      <HomeStack.Screen name="Documents"  component={DocumentsScreen}   options={{ title: t('screen.documents') }} />
      <HomeStack.Screen name="Employment" component={EmploymentScreen}  options={{ title: t('screen.grant') }} />
    </HomeStack.Navigator>
  );
}

function JobsStackNav() {
  const { t } = useTranslation();
  return (
    <JobsStack.Navigator screenOptions={HEADER_OPTS}>
      <JobsStack.Screen name="JobsMain"  component={JobsScreen}     options={{ title: t('nav.vacancies'), ...HEADER_BELL }} />
      <JobsStack.Screen name="JobDetail" component={JobDetailScreen} options={{ title: t('screen.vacancy') }} />
      <JobsStack.Screen name="Chat"      component={ChatScreen}      options={({ route }) => ({ title: route.params.title })} />
    </JobsStack.Navigator>
  );
}

function AppsStackNav() {
  const { t } = useTranslation();
  return (
    <AppsStack.Navigator screenOptions={HEADER_OPTS}>
      <AppsStack.Screen name="AppsList"       component={ApplicationsScreen} options={{ title: t('screen.myApplications'), ...HEADER_BELL }} />
      <AppsStack.Screen name="InterviewsList" component={InterviewsScreen}   options={{ title: t('screen.myInterviews') }} />
      <AppsStack.Screen name="Chat"           component={ChatScreen}         options={({ route }) => ({ title: route.params.title })} />
    </AppsStack.Navigator>
  );
}

function ChatsStackNav() {
  const { t } = useTranslation();
  return (
    <ChatsStack.Navigator screenOptions={HEADER_OPTS}>
      <ChatsStack.Screen name="ChatsList" component={ChatsListScreen} options={{ title: t('nav.chats'), ...HEADER_BELL }} />
      <ChatsStack.Screen name="Chat"      component={ChatScreen}      options={({ route }) => ({ title: route.params.title })} />
    </ChatsStack.Navigator>
  );
}

function EmployerChatsStackNav() {
  const { t } = useTranslation();
  return (
    <EmpChatsStack.Navigator screenOptions={HEADER_OPTS}>
      <EmpChatsStack.Screen name="EmployerChatsList" component={EmployerChatsListScreen} options={{ title: t('nav.chats'), ...HEADER_BELL }} />
      <EmpChatsStack.Screen name="EmployerChat"      component={ChatScreen}              options={({ route }) => ({ title: route.params.title })} />
    </EmpChatsStack.Navigator>
  );
}

// ─── Employer stack ──────────────────────────────────────────────
function EmployerStackNav() {
  const { t } = useTranslation();
  return (
    <EmpStack.Navigator screenOptions={HEADER_OPTS}>
      <EmpStack.Screen name="VacanciesList"       component={EmployerVacanciesScreen}    options={{ title: t('screen.myVacancies'), ...HEADER_BELL }} />
      <EmpStack.Screen name="VacancyForm"          component={EmployerVacancyFormScreen}  options={({ route }) => ({ title: route.params?.vacancy ? t('screen.editVacancy') : t('screen.newVacancy') })} />
      <EmpStack.Screen name="VacancyApplications" component={EmployerApplicationsScreen} options={{ title: t('screen.vacancyApplications') }} />
      <EmpStack.Screen name="CandidateDetail"     component={CandidateDetailScreen}      options={{ title: t('screen.candidate') }} />
      <EmpStack.Screen name="EmployerChat"        component={ChatScreen}                 options={({ route }) => ({ title: route.params.title })} />
    </EmpStack.Navigator>
  );
}

// ─── University stack ─────────────────────────────────────────────
function UniversityStackNav() {
  const { t } = useTranslation();
  return (
    <UniStack.Navigator screenOptions={HEADER_OPTS}>
      <UniStack.Screen name="AnalyticsDash" component={UniversityAnalyticsScreen} options={{ title: t('screen.analytics'), ...HEADER_BELL }} />
      <UniStack.Screen name="StudentsList"  component={UniversityStudentsScreen}  options={{ title: t('screen.students') }} />
    </UniStack.Navigator>
  );
}

// ─── Tab icon helper ──────────────────────────────────────────────
function Icon({ name, focused }: { name: string; focused: boolean }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.45 }}>{name}</Text>;
}

const TAB_OPTS = {
  tabBarActiveTintColor:   '#2563EB',
  tabBarInactiveTintColor: '#9CA3AF',
  tabBarStyle:             { paddingTop: 6, borderTopColor: '#E5E7EB' },
  tabBarLabelStyle:        { fontSize: 11, fontWeight: '600' as const },
  headerStyle:             { backgroundColor: '#fff' },
  headerTitleStyle:        { fontWeight: '700' as const, fontSize: 18 },
};

// ─── Role navigators ──────────────────────────────────────────────
function StudentTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator screenOptions={TAB_OPTS}>
      <Tab.Screen
        name="Home"
        component={HomeStackNav}
        options={{ title: t('nav.home'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Jobs"
        component={JobsStackNav}
        options={{ title: t('nav.vacancies'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="💼" focused={focused} /> }}
      />
      <Tab.Screen
        name="Applications"
        component={AppsStackNav}
        options={{ title: t('nav.applications'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="📋" focused={focused} /> }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsStackNav}
        options={{ title: t('nav.chats'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="💬" focused={focused} /> }}
      />
      <Tab.Screen
        name="Profile"
        component={StudentProfileEditScreen}
        options={{ title: t('nav.profile'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function EmployerTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator screenOptions={{ ...TAB_OPTS, tabBarActiveTintColor: '#7C3AED' }}>
      <Tab.Screen
        name="Vacancies"
        component={EmployerStackNav}
        options={{ title: t('nav.vacancies'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="💼" focused={focused} /> }}
      />
      <Tab.Screen
        name="EmployerChats"
        component={EmployerChatsStackNav}
        options={{ title: t('nav.chats'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="💬" focused={focused} /> }}
      />
      <Tab.Screen
        name="Interviews"
        component={EmployerInterviewsScreen}
        options={{ title: t('nav.interviews'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="📅" focused={focused} /> }}
      />
      <Tab.Screen
        name="CompanyProfile"
        component={EmployerCompanyProfileScreen}
        options={{ title: t('nav.company'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="🏢" focused={focused} /> }}
      />
      <Tab.Screen
        name="Account"
        component={ProfileScreen}
        options={{ title: t('nav.account'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function UniversityTabs() {
  const { t } = useTranslation();
  return (
    <Tab.Navigator screenOptions={{ ...TAB_OPTS, tabBarActiveTintColor: '#059669' }}>
      <Tab.Screen
        name="Analytics"
        component={UniversityStackNav}
        options={{ title: t('nav.analytics'), headerShown: false, tabBarIcon: ({ focused }) => <Icon name="📊" focused={focused} /> }}
      />
      <Tab.Screen
        name="Students"
        component={UniversityStudentsScreen}
        options={{ title: t('nav.students'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="🎓" focused={focused} /> }}
      />
      <Tab.Screen
        name="Account"
        component={ProfileScreen}
        options={{ title: t('nav.account'), headerRight: () => <NotificationBell />, tabBarIcon: ({ focused }) => <Icon name="👤" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

function MainTabs() {
  const { user } = useAuth();
  if (user?.role === 'employer')   return <EmployerTabs />;
  if (user?.role === 'university') return <UniversityTabs />;
  return <StudentTabs />;
}

// ─── Root navigator (tabs + notifications modal) ──────────────────
export default function MainNavigator() {
  const { t } = useTranslation();
  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainTabs" component={MainTabs} />
      <RootStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{
          headerShown: true,
          title: t('screen.notifications'),
          presentation: 'modal',
          headerStyle: { backgroundColor: '#fff' },
          headerTitleStyle: { fontWeight: '700' as const },
        }}
      />
    </RootStack.Navigator>
  );
}
