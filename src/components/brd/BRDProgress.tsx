import { CheckCircle, Circle, Users, Target, List, Database, Shield, FileText, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppState } from "@/contexts/AppStateContext";
const brdSections = [{
  icon: CheckCircle,
  title: "Executive Summary",
  description: "High level overview of the project",
  status: "pending"
}, {
  icon: Users,
  title: "Stakeholders",
  description: "Key people and roles involved",
  status: "pending"
}, {
  icon: Target,
  title: "Business Objectives",
  description: "Goals and success criteria",
  status: "pending"
}, {
  icon: List,
  title: "Functional Requirements",
  description: "What the system must do",
  status: "pending"
}, {
  icon: Database,
  title: "Data Requirements",
  description: "Data storage and processing needs",
  status: "pending"
}, {
  icon: Shield,
  title: "Security Requirements",
  description: "Security and compliance needs",
  status: "pending"
}];
interface BRDSection {
  title: string;
  description: string;
  content?: string;
}

interface BRDProgressProps {
  selectedSection: string;
  onSectionChange: (section: string) => void;
  completedSections: string[];
  hasProjectAndTemplate?: boolean;
  disabled?: boolean;
  onSectionClick?: (title: string, description: string) => void;
  showDocumentOverview?: boolean;
  dynamicSections?: BRDSection[];
}

const documentOverviewSections = [
  {
    id: "executive-summary",
    title: "Executive Summary",
    description: "High level overview of the project",
    icon: FileText
  },
  {
    id: "stakeholders",
    title: "Stakeholders",
    description: "Key people and roles involved",
    icon: Users
  },
  {
    id: "business-objectives",
    title: "Business Objectives",
    description: "Goals and success criteria",
    icon: Target
  },
  {
    id: "functional-requirements",
    title: "Functional Requirements",
    description: "What the system must do",
    icon: Settings
  },
  {
    id: "data-requirements",
    title: "Data Requirements",
    description: "Data storage and processing needs",
    icon: Database
  },
  {
    id: "security-requirements",
    title: "Security Requirements",
    description: "Security and compliance needs",
    icon: Shield
  }
];

export const BRDProgress = ({ selectedSection, onSectionChange, completedSections, hasProjectAndTemplate = false, disabled = false, onSectionClick, showDocumentOverview = false, dynamicSections }: BRDProgressProps) => {
  const { isBRDApproved } = useAppState();
  const completedCount = completedSections.length;
  
  // Use dynamic sections if available, otherwise fall back to static sections for progress tracking
  const sectionsToDisplay = dynamicSections && dynamicSections.length > 0 ? dynamicSections : brdSections;
  return (
    <div className="space-y-4">
      <Card className="h-[300px] sm:h-[400px] md:h-[500px] lg:h-[600px] flex flex-col">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base font-bold text-[hsl(var(--heading-primary))]">
              BRD Progress
              <div className="w-8 h-1 bg-primary rounded"></div>
            </CardTitle>
            {hasProjectAndTemplate && (
              <div className="text-sm text-muted-foreground">
                {completedCount}/{sectionsToDisplay.length} sections
              </div>
            )}
          </div>
        </CardHeader>
      <CardContent className="flex-1 overflow-y-auto pr-3">
        {disabled ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <div className="text-sm mb-2">Please upload files to begin</div>
              <div className="text-xs">Upload and submit files to get started</div>
            </div>
          </div>
        ) : !hasProjectAndTemplate && (!dynamicSections || dynamicSections.length === 0) ? (
          <div className="space-y-2">
            {documentOverviewSections.map((section) => {
              const IconComponent = section.icon;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionClick?.(section.title, section.description)}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-accent transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-muted-foreground group-hover:text-foreground mt-0.5">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground mb-0.5">
                        {section.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : dynamicSections && dynamicSections.length > 0 ? (
          <div className="space-y-2">
            {dynamicSections.map((section) => {
              const isActive = selectedSection === section.title;
              return (
                <button
                  key={section.title}
                  onClick={() => {
                    onSectionClick?.(section.title, section.description);
                    onSectionChange(section.title);
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors group ${
                    isActive ? 'bg-accent border-2 border-primary' : 'border-border hover:bg-accent'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-muted-foreground group-hover:text-foreground mt-0.5">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground mb-0.5">
                        {section.title}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {section.description}
                      </p>
                    </div>
                    {isBRDApproved && (
                      <div className="flex-shrink-0">
                        <div 
                          className="px-2 py-1 rounded-md text-xs font-medium"
                          style={{ 
                            color: '#008236', 
                            backgroundColor: '#DBFCE7' 
                          }}
                        >
                          Done
                        </div>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3 pr-2">
            {sectionsToDisplay.map(section => <div 
                key={section.title} 
                onClick={() => onSectionChange(section.title)}
                className={`flex items-start gap-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer ${
                  selectedSection === section.title ? 'bg-accent border-2 border-primary' : 'border border-[#ccc] rounded-[4px]'
                }`}
              >
                <div className="flex-1">
                  <div className="font-medium text-sm">{section.title}</div>
                  <div className="text-xs" style={{color: '#727272'}}>
                    {section.description}
                  </div>
                </div>
                {completedSections.includes(section.title) && (
                  <div className="flex-shrink-0">
                    <div 
                      className="px-2 py-1 rounded-md text-xs font-medium"
                      style={{ 
                        color: '#008236', 
                        backgroundColor: '#DBFCE7' 
                      }}
                    >
                      Done
                    </div>
                  </div>
                )}
              </div>)}
          </div>
        )}
      </CardContent>
    </Card>
  </div>
  );
};