/** What appears on the printed report/record papers — the school decides.
 *  Stored in schools.settings.reportConfig; every paper page reads this. */
export type ReportConfig = {
  logo: boolean;          // school logo top-left
  studentPhoto: boolean;  // child's photo top-right
  schoolName: boolean;    // the big heading
  motto: boolean;
  addressLine: boolean;   // address · phone · email under the heading
  attendance: boolean;    // attendance block on the terminal report
  gradeRemarks: boolean;  // the Remark column (Excellent, Very Good…)
  signatures: boolean;    // Class Teacher / Head Teacher signature lines
};

export const REPORT_CONFIG_DEFAULTS: ReportConfig = {
  logo: true, studentPhoto: true, schoolName: true, motto: true, addressLine: true,
  attendance: true, gradeRemarks: true, signatures: true,
};

export const REPORT_CONFIG_LABELS: Record<keyof ReportConfig, string> = {
  logo: "School logo",
  studentPhoto: "Student's photo",
  schoolName: "School name heading",
  motto: "Motto",
  addressLine: "Address · phone · email line",
  attendance: "Attendance block (terminal report)",
  gradeRemarks: "Remarks column (Excellent, Very Good…)",
  signatures: "Signature lines (Class Teacher / Head Teacher)",
};

export function getReportConfig(settings: Record<string, unknown>): ReportConfig {
  const stored = (settings?.reportConfig ?? {}) as Partial<ReportConfig>;
  return { ...REPORT_CONFIG_DEFAULTS, ...stored };
}
