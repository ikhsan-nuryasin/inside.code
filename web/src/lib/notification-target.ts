import type { Notification } from '../types/models';

function pick(data: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value) return value;
  }
  return '';
}

export function notificationTargetHref(notification: Notification): string {
  const data = (notification.data ?? {}) as Record<string, unknown>;
  const explicitUrl = pick(data, 'url');
  if (explicitUrl) {
    if (explicitUrl.startsWith('#')) return explicitUrl;
    try {
      const url = new URL(explicitUrl, window.location.origin);
      if (url.origin === window.location.origin) return url.hash || '#/notifications';
    } catch { /* invalid target falls back below */ }
    if (explicitUrl.startsWith('/')) return `#${explicitUrl}`;
  }
  const classId = pick(data, 'classId', 'class_id');
  const assignmentId = pick(data, 'taskId', 'assignmentId', 'assignment_id');
  const materialId = pick(data, 'materialId', 'material_id');
  const announcementId = pick(data, 'announcementId', 'announcement_id');
  const topicId = pick(data, 'topicId', 'topic_id');
  const pollId = pick(data, 'pollId', 'poll_id');
  const eventId = pick(data, 'eventId', 'event_id');
  const type = notification.notification_type;

  if (classId && assignmentId && type === 'assignment') return `#/classes/${classId}?tab=tasks&item=${encodeURIComponent(assignmentId)}`;
  if (classId && materialId && type === 'material') return `#/classes/${classId}?tab=materials&item=${encodeURIComponent(materialId)}`;
  if (classId && announcementId && type === 'announcement') return `#/classes/${classId}?tab=announcements&item=${encodeURIComponent(announcementId)}`;
  if (classId && topicId && type === 'forum') return `#/classes/${classId}?tab=forum&item=${encodeURIComponent(topicId)}`;
  if (classId && pollId && type === 'poll') return `#/classes/${classId}?tab=polling&item=${encodeURIComponent(pollId)}`;
  if (classId && eventId && (type === 'schedule' || type === 'group')) return `#/classes/${classId}?tab=calendar&item=${encodeURIComponent(eventId)}`;
  if (type === 'cash') return '#/cash';
  if (type === 'schedule') return '#/calendar';
  return '#/notifications';
}
