# Frontend Integration - Upload BRD to Confluence

## Summary of Changes

The frontend has been successfully updated to call the new backend endpoint for uploading BRDs to Confluence.

## What Changed

### 1. **integrationsApi.ts** - Added New API Function
**File**: `src/services/integrationsApi.ts`

**Added**:
- `UploadBRDToConfluenceRequest` interface
- `UploadBRDToConfluenceResponse` interface
- `uploadBRDToConfluence()` function that calls `/api/integrations/confluence/upload-brd`

**Usage**:
```typescript
const response = await integrationsApi.uploadBRDToConfluence(
  {
    brd_id: "uuid-of-brd",
    project_id: "uuid-of-project",
    page_title: "Optional Custom Title"
  },
  accessToken
);
```

### 2. **FileUploadSection.tsx** - Updated Upload Handler
**File**: `src/components/files/FileUploadSection.tsx`

**Changed**:
- `handleUploadToConfluence()` function now:
  - ✅ Calls the new backend API instead of directly creating Confluence pages
  - ✅ Fetches BRD from S3 (backend handles this)
  - ✅ Checks for `brdId` instead of `brdSections`
  - ✅ Validates user authentication
  - ✅ Shows better error messages
  - ✅ Opens the created Confluence page in a new tab

**Button Condition**:
- **Before**: `disabled={!isBRDApproved || isUploadingToConfluence}`
- **After**: `disabled={!brdId || isUploadingToConfluence}`

**Help Text**:
- **Before**: "Complete all BRD sections before submitting for approval"
- **After**: "Generate a BRD first, then upload it to your linked Confluence space"

## How It Works Now

### User Flow:
1. **User generates a BRD** (via file upload or Analyst Agent)
   - BRD is saved to S3 with a unique `brd_id`
   - Frontend stores the `brd_id` in state

2. **User clicks "Upload to Confluence"**
   - Frontend validates:
     - ✅ Project is selected
     - ✅ BRD exists (`brd_id` is available)
     - ✅ User is authenticated

3. **Frontend calls backend API**
   ```
   POST /api/integrations/confluence/upload-brd
   {
     "brd_id": "...",
     "project_id": "..."
   }
   ```

4. **Backend processes the request**:
   - Validates Atlassian credentials
   - Fetches project's Confluence space key
   - Downloads BRD from S3
   - Converts BRD to Confluence format
   - Creates new Confluence page
   - Returns page details

5. **Frontend shows success**:
   - Displays success toast with page title
   - Opens Confluence page in new tab
   - Navigates to Confluence view

## Error Handling

The frontend now handles these error cases:

| Error | Message |
|-------|---------|
| No project selected | "Please select a project first." |
| No BRD available | "No BRD available. Please generate a BRD first." |
| Not authenticated | "Please log in to upload to Confluence." |
| Atlassian not linked (400) | "Please link your Atlassian account and configure a Confluence space for this project." |
| Project not found (404) | "Project not found." |
| Other errors | "Failed to upload BRD to Confluence. Please try again." |

## Benefits of New Implementation

### ✅ **Simplified Frontend**
- Removed 130+ lines of HTML formatting code
- No longer needs to handle BRD structure conversion
- Backend handles all S3 and Confluence operations

### ✅ **Better Data Source**
- Uses the **actual BRD from S3** (source of truth)
- Not dependent on frontend state (`brdSections`)
- Works even if user refreshes the page

### ✅ **Proper Architecture**
- Frontend → Backend API → S3 + Confluence
- Backend handles credentials securely
- Consistent with other integration endpoints

### ✅ **Better UX**
- Opens Confluence page automatically
- Clear error messages
- Shows page title in success message

## Testing Checklist

To test the integration:

- [ ] Generate a BRD (via file upload or Analyst Agent)
- [ ] Verify `brdId` is set in state
- [ ] Click "Upload to Confluence" button
- [ ] Verify success toast appears
- [ ] Verify Confluence page opens in new tab
- [ ] Check that page contains BRD content
- [ ] Test error cases (no BRD, no project, not linked)

## Next Steps (Optional Enhancements)

1. **Add loading indicator** while fetching from S3
2. **Show preview** of what will be uploaded
3. **Add confirmation dialog** before uploading
4. **Store Confluence page ID** in database for future updates
5. **Add "View in Confluence"** button after upload
