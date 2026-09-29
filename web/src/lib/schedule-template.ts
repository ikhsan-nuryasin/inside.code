
export interface ScheduleTemplateRow {
  day_of_week: number;
  starts_at: string;
  ends_at: string;
  subject_name: string;
  course_code: string;
  lecturer_code: string;
  lecturer_code_secondary: string | null;
  credits: number;
  practical_group: string | null;
  room: string | null;
}

// Manually transcribed from the supplied timetable image.
export const semester3ScheduleTemplate: ScheduleTemplateRow[] = [
  { day_of_week:1, starts_at:'17:30:00', ends_at:'19:30:00', subject_name:'SISTEM INFORMASI MANAJEMEN', course_code:'240', lecturer_code:'TRT', lecturer_code_secondary:null, credits:3, practical_group:null, room:'301-E5' },
  { day_of_week:1, starts_at:'19:30:00', ends_at:'21:30:00', subject_name:'KEAMANAN BASIS DATA', course_code:'0405', lecturer_code:'ECR', lecturer_code_secondary:null, credits:3, practical_group:null, room:'301-E5' },
  { day_of_week:2, starts_at:'17:30:00', ends_at:'19:30:00', subject_name:'METODOLOGI PENELITIAN', course_code:'0367', lecturer_code:'WYR', lecturer_code_secondary:null, credits:3, practical_group:null, room:'301-E5' },
  { day_of_week:2, starts_at:'19:30:00', ends_at:'21:30:00', subject_name:'WEB PROGRAMMING II', course_code:'0407', lecturer_code:'FZR', lecturer_code_secondary:null, credits:3, practical_group:'WPP.19.3B.14A', room:'301-E5' },
  { day_of_week:3, starts_at:'18:10:00', ends_at:'19:30:00', subject_name:'BAHASA INDONESIA', course_code:'253', lecturer_code:'RBP', lecturer_code_secondary:null, credits:2, practical_group:null, room:'E1.3-E5' },
  { day_of_week:3, starts_at:'19:30:00', ends_at:'21:30:00', subject_name:'CHARACTER BUILDING', course_code:'154', lecturer_code:'CYG', lecturer_code_secondary:null, credits:3, practical_group:null, room:'E1.3-E5' },
  { day_of_week:4, starts_at:'17:30:00', ends_at:'19:30:00', subject_name:'FUNDAMENTAL DATA ANALYST', course_code:'0406', lecturer_code:'IMK', lecturer_code_secondary:null, credits:3, practical_group:null, room:'301-E5' },
  { day_of_week:4, starts_at:'19:30:00', ends_at:'21:30:00', subject_name:'STATISTIKA DAN PROBABILITAS', course_code:'0624', lecturer_code:'ERH', lecturer_code_secondary:null, credits:3, practical_group:null, room:'301-E5' },
];
