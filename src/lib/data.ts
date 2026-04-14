import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Car, Package, User } from "lucide-react";

export type Camera = {
  id: string;
  name: string;
  location: string;
  status: 'Online' | 'Offline';
  thumbnailUrlId: string;
};

export type Event = {
  id: string;
  type: string;
  Icon: LucideIcon;
  camera: string;
  location: string;
  timestamp: string;
  anomalyScore: number;
  thumbnailUrlId: string;
};

export type Alert = {
  id: string;
  summary: string;
  timestamp: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
};

export const cameras: Camera[] = [
  { id: 'cam-01', name: 'Lobby Cam', location: 'Main Lobby', status: 'Online', thumbnailUrlId: 'feed-3' },
  { id: 'cam-02', name: 'Parking Lot Cam', location: 'East Parking Lot', status: 'Online', thumbnailUrlId: 'feed-2' },
  { id: 'cam-03', name: 'Entrance Cam', location: 'Main Entrance', status: 'Offline', thumbnailUrlId: 'feed-1' },
  { id: 'cam-04', name: 'Rooftop Cam', location: 'Building A Rooftop', status: 'Online', thumbnailUrlId: 'feed-4' },
];

export const events: Event[] = [
  {
    id: 'evt-001',
    type: 'Person Detected',
    Icon: User,
    camera: 'Entrance Cam',
    location: 'Main Entrance',
    timestamp: '2024-07-23T14:30:00Z',
    anomalyScore: 85,
    thumbnailUrlId: 'event-1',
  },
  {
    id: 'evt-002',
    type: 'Vehicle Detected',
    Icon: Car,
    camera: 'Parking Lot Cam',
    location: 'East Parking Lot',
    timestamp: '2024-07-23T14:28:15Z',
    anomalyScore: 40,
    thumbnailUrlId: 'event-2',
  },
  {
    id: 'evt-003',
    type: 'Package Delivered',
    Icon: Package,
    camera: 'Entrance Cam',
    location: 'Main Entrance',
    timestamp: '2024-07-23T13:15:45Z',
    anomalyScore: 10,
    thumbnailUrlId: 'event-3',
  },
  {
    id: 'evt-004',
    type: 'Unusual Activity',
    Icon: AlertTriangle,
    camera: 'Lobby Cam',
    location: 'Main Lobby',
    timestamp: '2024-07-23T11:05:20Z',
    anomalyScore: 92,
    thumbnailUrlId: 'event-1',
  },
  {
    id: 'evt-005',
    type: 'Vehicle Detected',
    Icon: Car,
    camera: 'Parking Lot Cam',
    location: 'East Parking Lot',
    timestamp: '2024-07-23T10:55:00Z',
    anomalyScore: 30,
    thumbnailUrlId: 'event-2',
  },
];

export const alerts: Alert[] = [
  { id: 'al-1', summary: 'High-risk individual detected near main entrance after hours.', timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), severity: 'Critical' },
  { id: 'al-2', summary: 'Unusual loitering detected in the parking lot.', timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(), severity: 'High' },
  { id: 'al-3', summary: 'Camera `Entrance Cam` went offline.', timestamp: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), severity: 'Medium' },
];

export const user = {
  name: 'Alex Wolfe',
  email: 'alex.wolfe@example.com',
  avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d'
};
