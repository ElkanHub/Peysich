/** Homework is a RECORD in Peysich — set and referenced, not done in-app.
 *  How much gets recorded is the school's choice:
 *  - recordSubmissions: track who handed in (parents can see it)
 *  - recordMarks: also record marks/feedback in-app (off by default — most
 *    schools mark in the books and don't want double entry) */
export type HomeworkConfig = { recordSubmissions: boolean; recordMarks: boolean };

export const HOMEWORK_CONFIG_DEFAULTS: HomeworkConfig = {
  recordSubmissions: true, recordMarks: false,
};

export function getHomeworkConfig(settings: Record<string, unknown>): HomeworkConfig {
  return { ...HOMEWORK_CONFIG_DEFAULTS, ...((settings?.homeworkConfig ?? {}) as Partial<HomeworkConfig>) };
}
