export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'MINI_JOB' | 'FREELANCER';

export type SkillLevel = 'BASIC' | 'INTERMEDIATE' | 'EXPERT';

export interface StaffSummary {
  id: string;
  staffNumber: string;
  firstName: string;
  lastName: string;
  color: string;
}

export interface StaffProfile extends StaffSummary {
  email: string | null;
  phone: string | null;
  mobile: string | null;
  employmentType: EmploymentType;
  weeklyHours: number | null;
  isActive: boolean;
}
