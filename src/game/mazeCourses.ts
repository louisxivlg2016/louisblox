import { create } from 'zustand';

export const MAZE_COURSE_COUNT = 100;

export const useMazeCourseStore = create<{ index: number; setCourse: (index: number) => void; nextCourse: () => number }>((set, get) => ({
  index: 0,
  setCourse: (index) => set({ index: ((Math.floor(index) % MAZE_COURSE_COUNT) + MAZE_COURSE_COUNT) % MAZE_COURSE_COUNT }),
  nextCourse: () => {
    const index = (get().index + 1) % MAZE_COURSE_COUNT;
    set({ index });
    return index;
  },
}));
