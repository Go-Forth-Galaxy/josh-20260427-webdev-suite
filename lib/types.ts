export type Project = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  files: {
    html: string;
    css: string;
    js: string;
  };
};

export type ProjectSummary = Omit<Project, "files">;
