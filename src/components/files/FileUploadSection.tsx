import { useRef, useState } from "react";
import { Download, Upload, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { uploadFiles, downloadBRD } from "@/services/projectApi";
import { useAppState } from "@/contexts/AppStateContext";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  timestamp: string;
  originalFile?: File;
}

interface FileUploadSectionProps {
  onUploadSuccess?: (response?: any) => void;
}

export const FileUploadSection = ({ onUploadSuccess }: FileUploadSectionProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [isUploadingToConfluence, setIsUploadingToConfluence] = useState(false);
  const {
    isFileUploading,
    setIsFileUploading,
    setPendingUploadResponse,
    uploadedFileBatches,
    addUploadedFileBatch,
    uploadedFiles,
    setUploadedFiles,
    isBRDApproved,
    selectedProject,
    setIsBRDApproved,
    brdId,
    setBrdId,
    isBRDDownloading,
    setIsBRDDownloading,
    brdSections,
    setActiveConfluencePageId,
  } = useAppState();

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      const emptyFiles = fileArray.filter((file) => file.size === 0);

      if (emptyFiles.length > 0) {
        toast({
          title: "Empty file detected",
          description: `"${emptyFiles.map((f) => f.name).join(", ")}" contains no data. Please upload a file with content.`,
          variant: "destructive",
        });
        return;
      }

      const newFiles: UploadedFile[] = fileArray.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        name: file.name.includes(".") ? file.name.split(".")[0] : file.name,
        size: formatFileSize(file.size),
        timestamp: "Just now",
        originalFile: file,
      }));

      setUploadedFiles((prev) => [...prev, ...newFiles]);
      toast({
        title: "Files uploaded successfully",
        description: `${newFiles.length} file(s) added to your workspace.`,
      });
    }
    // Reset input value to allow uploading the same file again
    if (event.target) {
      event.target.value = "";
    }
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
    toast({
      title: "File deleted",
      description: "File has been removed from your workspace.",
    });
  };

  const handleDownloadFile = (file: UploadedFile) => {
    if (file.originalFile) {
      const url = URL.createObjectURL(file.originalFile);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.originalFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      toast({
        title: "Download unavailable",
        description: "This file cannot be downloaded as it's not available locally.",
        variant: "destructive",
      });
    }
  };

  const triggerFileUpload = () => {
    if (!selectedProject) {
      toast({
        title: "No project selected",
        description: "Please select or create a project before uploading files.",
        variant: "destructive",
      });
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSubmitFiles = async () => {
    if (uploadedFiles.length === 0) return;

    const filesToUpload = uploadedFiles
      .map((file) => file.originalFile)
      .filter((file): file is File => file !== undefined);

    if (filesToUpload.length === 0) {
      toast({
        title: "No files to upload",
        description: "Please select files before submitting.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedProject) {
      toast({
        title: "No project selected",
        description: "Please select a project before generating a BRD.",
        variant: "destructive",
      });
      return;
    }

    const emptyFiles = filesToUpload.filter((file) => file.size === 0);
    if (emptyFiles.length > 0) {
      toast({
        title: "Empty file detected",
        description: `"${emptyFiles.map((f) => f.name).join(", ")}" contains no data. Please upload a file with content.`,
        variant: "destructive",
      });
      return;
    }

    setIsFileUploading(true);
    try {
      const response = await uploadFiles(filesToUpload, selectedProject?.project_id);

      // Store brdId from response
      if (response.brd_auto_generated?.brd_id) {
        setBrdId(response.brd_auto_generated.brd_id);
      }

      // Add batch with content preview
      const batch = {
        id: `batch-${Date.now()}`,
        files: uploadedFiles.map((f) => ({ name: f.name, size: f.size })),
        contentPreview:
          response.brd_auto_generated?.content_preview || response.message || "Files processed successfully",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };
      addUploadedFileBatch(batch);

      // Clear current files to allow new upload
      setUploadedFiles([]);

      // Remove "Done" badges from BRD Progress
      setIsBRDApproved(false);

      setPendingUploadResponse(response);
      onUploadSuccess?.(response);
    } catch (error: any) {
      // Keep files in the list and maintain download/delete options on failure
      const msg = error?.message || "";
      let description = "Failed to upload files. Please try again.";
      // Extract backend error message (e.g. empty transcript)
      try {
        const jsonPart = msg.substring(msg.indexOf("{"));
        const parsed = JSON.parse(jsonPart);
        if (parsed.error) description = parsed.error;
      } catch {
        if (msg.toLowerCase().includes("empty") || msg.toLowerCase().includes("too short")) {
          description = "The uploaded transcript appears to be empty or too short. Please upload a file with meaningful content.";
        }
      }
      toast({
        title: "BRD Generation Failed",
        description,
        variant: "destructive",
      });
    } finally {
      setIsFileUploading(false);
    }
  };

  const handleDownloadBRD = async () => {
    if (brdSections.length === 0) {
      toast({
        title: "No BRD available",
        description: "Please complete the BRD sections first.",
        variant: "destructive",
      });
      return;
    }

    // Format BRD sections as text content for download
    const brdContent = brdSections
      .map((section) => `${section.title}\n\n${section.description}\n\n${section.content || ""}`)
      .join("\n\n---\n\n");

    const projectName = selectedProject?.project_name || "project";
    const filename = `${projectName}_brd`;

    setIsBRDDownloading(true);
    try {
      const blob = await downloadBRD(brdContent, filename, brdId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      // Backend returns .docx format now
      const extension = brdId && brdId !== "none" ? ".docx" : ".docx";
      a.download = `${filename}${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "BRD downloaded",
        description: "Your BRD has been downloaded successfully.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download BRD. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsBRDDownloading(false);
    }
  };

  const handleUploadToConfluence = async () => {
    if (!selectedProject || !brdId) {
      toast({
        title: "Cannot upload to Confluence",
        description: !selectedProject
          ? "Please select a project first."
          : "No BRD available. Please generate a BRD first.",
        variant: "destructive",
      });
      return;
    }

    // Check if user is authenticated
    if (!accessToken) {
      toast({
        title: "Authentication required",
        description: "Please log in to upload to Confluence.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingToConfluence(true);
    try {
      // Import the integrationsApi
      const { integrationsApi } = await import('@/services/integrationsApi');

      // Call the new backend endpoint
      const response = await integrationsApi.uploadBRDToConfluence(
        {
          brd_id: brdId,
          project_id: selectedProject.project_id,
          // Optional: customize page title
          // page_title: `${selectedProject.project_name} - BRD`
        },
        accessToken
      );

      // Set the newly created page as active
      if (response.confluence_page?.id) {
        setActiveConfluencePageId(response.confluence_page.id);
      }

      toast({
        title: "BRD uploaded to Confluence",
        description: `Successfully created page: ${response.confluence_page.title}`,
      });

      // Optionally open the Confluence page in a new tab
      if (response.confluence_page?.web_url) {
        window.open(response.confluence_page.web_url, '_blank');
      }

      // Navigate to Confluence page after successful upload
      navigate("/confluence");
    } catch (error: any) {
      console.error('Error uploading to Confluence:', error);

      let errorMessage = "Failed to upload BRD to Confluence. Please try again.";

      if (error.response?.status === 400) {
        errorMessage = error.response.data?.detail || "Please link your Atlassian account and configure a Confluence space for this project.";
      } else if (error.response?.status === 404) {
        errorMessage = "Project not found.";
      }

      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsUploadingToConfluence(false);
    }
  };

  return (
    <Card className="h-auto xl:h-[600px] flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base font-bold text-[hsl(var(--heading-primary))] break-words">
              Upload Files
            </CardTitle>
            <p className="text-sm mt-1 text-muted-label">
              {uploadedFiles.length} file{uploadedFiles.length !== 1 ? "s" : ""} ready to submit
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">Accepted Formats</span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-red-50 text-red-600 border border-red-100">PDF</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-600 border border-blue-100">DOCX</span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 border border-gray-200">TXT</span>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".txt,.docx,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileUpload}
              className="bg-white border border-[#3B3B3B] hover:bg-gray-50 w-full sm:w-auto"
            >
              <Upload className="w-4 h-4 text-[#3B3B3B] mr-2 sm:mr-0" />
              <span className="sm:hidden">Upload Files</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pr-2">
        <div className="space-y-4">
          {/* Previously uploaded batches */}
          {uploadedFileBatches.map((batch) => (
            <div key={batch.id} className="border border-border rounded-lg p-3 bg-muted/30">
              <div className="space-y-2">
                {batch.files.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 opacity-60">
                    <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate">{file.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {file.size} • {batch.timestamp}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Current files being prepared */}
          {uploadedFiles.length === 0 && uploadedFileBatches.length === 0 ? (
            <div className="flex items-center justify-center h-24 sm:h-32 text-muted-foreground text-center">
              <p className="text-sm text-muted-label">
                No file selected.
              </p>
            </div>
          ) : uploadedFiles.length > 0 ? (
            <div className="space-y-3 mb-4">
              {uploadedFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex flex-col sm:flex-row sm:items-center p-3 border border-border rounded-lg gap-3"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0 flex-grow">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm truncate" title={file.name}>
                        {file.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {file.size} • {file.timestamp}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadFile(file)}
                      className="h-8 w-8 p-0"
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteFile(file.id)}
                      className="text-destructive hover:text-destructive h-8 w-8 p-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}

          {uploadedFiles.length > 0 && (
            <div className="mt-6 space-y-4">
              <Button
                variant="outline"
                className="w-full justify-center gap-2 h-12 bg-white border border-[#8C8C8C] hover:bg-gray-50"
                onClick={handleSubmitFiles}
                disabled={uploadedFiles.length === 0 || isFileUploading}
              >
                {isFileUploading ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent flex-shrink-0" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                      />
                    </svg>
                    <span>Submit Files</span>
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="mt-4">
            <h4 className="font-medium mb-3">Actions</h4>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-center items-center h-12 bg-white border border-[#8C8C8C] hover:bg-gray-50 px-3"
                disabled={!brdId || isUploadingToConfluence}
                onClick={handleUploadToConfluence}
              >
                {isUploadingToConfluence ? (
                  <>
                    <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2 flex-shrink-0" />
                    <span className="truncate">Uploading...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2 flex-shrink-0" />
                    <span className="truncate">Upload to Confluence</span>
                  </>
                )}
              </Button>
              <p className="text-xs px-2 text-muted-label">
                Generate a BRD first, then upload it to your linked Confluence space
              </p>
            </div>
            <Button
              className="w-full mt-4"
              variant="default"
              disabled={brdSections.length === 0 || isBRDDownloading}
              onClick={handleDownloadBRD}
            >
              {isBRDDownloading ? (
                <>
                  <div className="w-4 h-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2 flex-shrink-0" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2 flex-shrink-0" />
                  <span>Download BRD</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
