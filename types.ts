export type Tab = 'dashboard' | 'schedules' | 'drivers' | 'vehicles' | 'workTeams' | 'data';
export type DataSource = 'googleSheets' | 'local';

export interface Schedule {
  id: string;
  date: string;
  work_team: string;
  work_time: string;
  driver_name: string;
  vehicle_number: string;
  break_time?: string;
  meal_time?: string;
  notes?: string;
}

export interface Driver {
  id: string;
  driver_name: string;
  contact: string;
  hire_date: string;
}

export interface Vehicle {
  id: string;
  vehicle_number: string;
  vehicle_model: string;
  registration_date: string;
}

export interface WorkTeam {
  id: string;
  work_team: string;
  shift_name: string;
  work_pattern: 'weekly' | 'alternate_odd' | 'alternate_even';
  start_day: string;
  end_day: string;
  start_time: string;
  end_time: string;
}

export interface AppData {
  schedules: Schedule[];
  drivers: Driver[];
  vehicles: Vehicle[];
  workTeams: WorkTeam[];
}

export type SingularDataType = 'schedule' | 'driver' | 'vehicle' | 'workTeam';

export interface DataActions {
    add: (type: SingularDataType, item: Omit<Schedule, 'id'> | Omit<Driver, 'id'> | Omit<Vehicle, 'id'> | Omit<WorkTeam, 'id'>) => Promise<void>;
    update: (type: SingularDataType, item: Schedule | Driver | Vehicle | WorkTeam) => Promise<void>;
    remove: (type: SingularDataType, id: string) => Promise<void>;
    bulkRemove: (type: SingularDataType, ids: string[]) => Promise<void>;
}