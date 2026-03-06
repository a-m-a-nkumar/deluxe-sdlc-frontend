# ✅ Project ID Analysis - Frontend

## Summary

**YES, project_id IS being created in the frontend!**

---

## 📍 Where Project ID is Created

### **File:** `src/services/projectApi.ts`

#### **1. New Project Creation** (Line 39-52)
```typescript
export const createProject = async (projectData: CreateProjectRequest): Promise<CreateProjectResponse> => {
  const newProject: Project = {
    project_id: crypto.randomUUID(),  // ← PROJECT ID CREATED HERE
    project_name: projectData.project_name,
    description: projectData.description,
    jira_project_key: projectData.jira_project_key,
    confluence_space_key: projectData.confluence_space_key,
    created_at: new Date().toISOString(),
  };

  const projects = readLocalProjects();
  projects.push(newProject);
  writeLocalProjects(projects);
  return newProject;
};
```

**Method:** `crypto.randomUUID()` - Generates a unique UUID  
**Example:** `"550e8400-e29b-41d4-a716-446655440000"`

#### **2. Default Project Creation** (Line 55-73)
```typescript
export const fetchProjects = async (): Promise<Project[]> => {
  const projects = readLocalProjects();

  // Ensure at least one default project exists
  if (projects.length === 0) {
    const defaultProject: Project = {
      project_id: "local-project",  // ← DEFAULT PROJECT ID
      project_name: "Local BRD Project",
      description: "Local project placeholder",
      jira_project_key: "LOC",
      confluence_space_key: "LOC",
      created_at: new Date().toISOString(),
    };
    writeLocalProjects([defaultProject]);
    return [defaultProject];
  }

  return projects;
};
```

**Default ID:** `"local-project"` (hardcoded for first-time users)

---

## 💾 Storage Location

### **localStorage Key:** `"local_brd_projects"`

**Data Structure:**
```json
[
  {
    "project_id": "550e8400-e29b-41d4-a716-446655440000",
    "project_name": "My BRD Project",
    "description": "Project description",
    "jira_project_key": "PROJ",
    "confluence_space_key": "CONF",
    "created_at": "2026-02-02T05:20:47.000Z"
  }
]
```

---

## 🔄 How Project ID is Used

### **1. Sent to Backend** (`src/services/analystApi.ts`)

#### **Analyst Chat API** (Line 226-237)
```typescript
export async function* streamAnalystMessage(
  message: string,
  projectId?: string | null  // ← Project ID parameter
): AsyncGenerator<string, void, unknown> {
  const formData = new FormData();
  formData.append("message", message);
  formData.append("session_id", AnalystSessionManager.getSessionId() || "none");
  
  if (projectId) {
    formData.append("project_id", projectId);  // ← Sent to backend
  }
  
  // ... API call
}
```

### **2. UI Selection** (`src/components/modals/CreateProjectModal.tsx`)

Users can:
- ✅ Create new projects (generates new UUID)
- ✅ Select existing projects from dropdown
- ✅ Project ID is passed to analyst chat

---

## 📊 Data Flow

```
User Creates Project
    ↓
crypto.randomUUID() generates project_id
    ↓
Stored in localStorage ("local_brd_projects")
    ↓
User selects project in UI
    ↓
project_id sent to backend via FormData
    ↓
Backend receives project_id in analyst-chat endpoint
```

---

## 🎯 Current Implementation

| Feature | Status | Location |
|---------|--------|----------|
| **Project ID Generation** | ✅ Working | `projectApi.ts:41` |
| **Default Project** | ✅ Working | `projectApi.ts:61` |
| **localStorage Storage** | ✅ Working | `projectApi.ts:23-37` |
| **Send to Backend** | ✅ Working | `analystApi.ts:236` |
| **UI Selection** | ✅ Working | `CreateProjectModal.tsx` |

---

## 🔑 Key Points

1. **Project ID Format:** UUID v4 (e.g., `550e8400-e29b-41d4-a716-446655440000`)
2. **Default Project ID:** `"local-project"` (created automatically)
3. **Storage:** localStorage (key: `"local_brd_projects"`)
4. **Backend Integration:** Sent via `FormData` in analyst chat requests
5. **User Control:** Users can create/select projects via UI

---

## 🔄 Relationship with Session ID

**Project ID** and **Session ID** are different:

| Attribute | Project ID | Session ID |
|-----------|-----------|------------|
| **Purpose** | Groups related BRDs | Tracks conversation |
| **Created** | When user creates project | When user starts chat |
| **Stored** | localStorage (`local_brd_projects`) | localStorage (`analyst_current_session_id`) |
| **Sent to Backend** | ✅ Yes (optional) | ✅ Yes (required) |
| **Lifespan** | Permanent (until deleted) | Per conversation |

**Relationship:**
- One project can have multiple sessions
- Each session belongs to one project (optional)
- Backend can use project_id to group sessions

---

## ✅ Conclusion

**YES, project_id is fully implemented in the frontend:**

- ✅ Created using `crypto.randomUUID()`
- ✅ Stored in localStorage
- ✅ Sent to backend in analyst chat requests
- ✅ Users can create and select projects
- ✅ Default project created automatically

**The frontend is ready for database integration!**
