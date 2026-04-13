import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import {
  buildConfig,
  extractAccountId,
  getAccount,
  listOrganizations,
  listProjects,
  type HarnessCredentials,
  type HarnessOrg,
  type HarnessProject,
} from "@/services/harnessApi";

interface Props {
  credentials: HarnessCredentials;
  onSave: (creds: HarnessCredentials) => void;
}

export default function SettingsSection({ credentials, onSave }: Props) {
  const [apiKey, setApiKey] = useState(credentials.apiKey);
  const [accountId, setAccountId] = useState(credentials.accountId);
  const [orgId, setOrgId] = useState(credentials.orgId);
  const [projectId, setProjectId] = useState(credentials.projectId);

  const [orgs, setOrgs] = useState<HarnessOrg[]>([]);
  const [projects, setProjects] = useState<HarnessProject[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [saveError, setSaveError] = useState("");
  const [accountInfo, setAccountInfo] = useState<any>(null);

  // Auto-load orgs + projects on mount if credentials already saved
  useEffect(() => {
    if (!credentials.apiKey) return;
    const load = async () => {
      const config = buildConfig(credentials.apiKey);
      try {
        setLoadingOrgs(true);
        const orgList = await listOrganizations(config);
        setOrgs(orgList);
        setLoadingOrgs(false);
        if (credentials.orgId) {
          setLoadingProjects(true);
          const projList = await listProjects(config, credentials.orgId);
          setProjects(projList);
          setLoadingProjects(false);
        }
      } catch {
        setLoadingOrgs(false);
        setLoadingProjects(false);
      }
    };
    load();
  }, []);

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    setAccountId(extractAccountId(val));
    setOrgs([]);
    setProjects([]);
    setOrgId("");
    setProjectId("");
    setTestResult(null);
  };

  const handleConnect = async () => {
    if (!apiKey) return;
    setTesting(true);
    setTestResult(null);
    setOrgs([]);
    setProjects([]);
    setOrgId("");
    setProjectId("");
    try {
      const config = buildConfig(apiKey);
      const acct = await getAccount(config);
      setAccountInfo(acct);
      setTestResult({ ok: true, message: "Connected! Now select your organization and project." });
      // Auto-load orgs
      setLoadingOrgs(true);
      const orgList = await listOrganizations(config);
      setOrgs(orgList);
    } catch (e: any) {
      setTestResult({ ok: false, message: e.message || "Connection failed. Check your PAT token." });
    } finally {
      setTesting(false);
      setLoadingOrgs(false);
    }
  };

  const handleOrgChange = async (selectedOrg: string) => {
    setOrgId(selectedOrg);
    setProjectId("");
    setProjects([]);
    if (!selectedOrg) return;
    setLoadingProjects(true);
    try {
      const config = buildConfig(apiKey);
      const projList = await listProjects(config, selectedOrg);
      setProjects(projList);
    } catch {
      setProjects([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleSave = () => {
    if (!apiKey) { setSaveError("PAT Token is required."); return; }
    if (!orgId) { setSaveError("Please select an Organization."); return; }
    if (!projectId) { setSaveError("Please select a Project."); return; }
    setSaveError("");
    onSave({ apiKey, accountId: accountId || extractAccountId(apiKey), orgId, projectId });
  };

  const detectedAccountId = extractAccountId(apiKey);
  const isConnected = testResult?.ok;

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-lg font-semibold mb-1">Harness Settings</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Connect your Harness account. Credentials are stored in your browser session.
      </p>

      <Card>
        <CardContent className="pt-6 space-y-4">

          {/* Step 1 — PAT Token */}
          <div>
            <label className="text-sm font-medium block mb-1">
              PAT Token <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="pat.xxxxxxxx.xxxxxxxx.xxxxxxxx"
                value={apiKey}
                onChange={e => handleApiKeyChange(e.target.value)}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleConnect} disabled={testing || !apiKey}>
                {testing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : isConnected
                    ? <><RefreshCw className="w-4 h-4 mr-1" /> Reconnect</>
                    : "Connect"
                }
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Harness → My Profile → API Keys → Create Token
            </p>
          </div>

          {/* Account ID (read-only) */}
          {detectedAccountId && (
            <div>
              <label className="text-sm font-medium block mb-1">Account ID</label>
              <Input value={detectedAccountId} readOnly className="bg-muted/40 font-mono text-xs" />
            </div>
          )}

          {/* Connection result */}
          {testResult && (
            <div className={`flex items-start gap-2 p-3 rounded-md text-sm ${
              testResult.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
            }`}>
              {testResult.ok
                ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              }
              {testResult.message}
            </div>
          )}

          {/* Account info */}
          {accountInfo && (
            <div className="bg-muted/30 border rounded-lg p-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              <div className="text-muted-foreground">Account name</div>
              <div className="font-medium">{accountInfo.name}</div>
              <div className="text-muted-foreground">Company</div>
              <div>{accountInfo.companyName || "—"}</div>
              <div className="text-muted-foreground">Plan</div>
              <div><span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">{accountInfo.accountType || "—"}</span></div>
              <div className="text-muted-foreground">Status</div>
              <div><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${accountInfo.accountStatus === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{accountInfo.accountStatus || "—"}</span></div>
              <div className="text-muted-foreground">Cluster</div>
              <div className="font-mono text-xs">{accountInfo.cluster || "—"}</div>
            </div>
          )}

          {/* Step 2 — Org dropdown (only shown after connect) */}
          {(orgs.length > 0 || credentials.orgId) && (
            <div>
              <label className="text-sm font-medium block mb-1">
                Organization <span className="text-red-500">*</span>
              </label>
              {loadingOrgs ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading organizations...
                </div>
              ) : (
                <select
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                  value={orgId}
                  onChange={e => handleOrgChange(e.target.value)}
                >
                  <option value="">Select organization...</option>
                  {orgs.map(o => (
                    <option key={o.identifier} value={o.identifier}>
                      {o.name} ({o.identifier})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Step 3 — Project dropdown (only shown after org selected) */}
          {orgId && (
            <div>
              <label className="text-sm font-medium block mb-1">
                Project <span className="text-red-500">*</span>
              </label>
              {loadingProjects ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading projects...
                </div>
              ) : (
                <select
                  className="w-full border rounded px-3 py-2 text-sm bg-background"
                  value={projectId}
                  onChange={e => setProjectId(e.target.value)}
                >
                  <option value="">Select project...</option>
                  {projects.map(p => (
                    <option key={p.identifier} value={p.identifier}>
                      {p.name} ({p.identifier})
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {saveError && (
            <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded">
              {saveError}
            </div>
          )}

          <div className="pt-2">
            <Button onClick={handleSave} disabled={!orgId || !projectId}>
              Save & Continue
            </Button>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}
