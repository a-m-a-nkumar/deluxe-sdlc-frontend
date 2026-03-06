import React, { useState } from 'react';
import { integrationsApi } from '../../services/integrationsApi';
import { useAuth } from '../../contexts/AuthContext';
import './LinkAtlassianModal.css';

interface LinkAtlassianModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export const LinkAtlassianModal: React.FC<LinkAtlassianModalProps> = ({
    isOpen,
    onClose,
    onSuccess
}) => {
    const { accessToken } = useAuth();
    const [domain, setDomain] = useState('');
    const [email, setEmail] = useState('');
    const [apiToken, setApiToken] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!accessToken) {
            setError('You must be logged in to link your Atlassian account');
            setLoading(false);
            return;
        }

        try {
            await integrationsApi.linkAtlassianAccount({
                domain,
                email,
                api_token: apiToken
            }, accessToken);

            onSuccess();
            onClose();

            // Reset form
            setDomain('');
            setEmail('');
            setApiToken('');
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to link account. Please check your credentials.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Link Atlassian Account</h2>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="domain">Atlassian Domain</label>
                            <input
                                id="domain"
                                type="text"
                                placeholder="mycompany.atlassian.net"
                                value={domain}
                                onChange={(e) => setDomain(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <small className="form-hint">
                                Your Atlassian Cloud domain (without https://)
                            </small>
                        </div>

                        <div className="form-group">
                            <label htmlFor="email">Email Address</label>
                            <input
                                id="email"
                                type="email"
                                placeholder="you@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                disabled={loading}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="apiToken">API Token</label>
                            <input
                                id="apiToken"
                                type="password"
                                placeholder="Your Atlassian API token"
                                value={apiToken}
                                onChange={(e) => setApiToken(e.target.value)}
                                required
                                disabled={loading}
                            />
                            <small className="form-hint">
                                Generate at:{' '}
                                <a
                                    href="https://id.atlassian.com/manage-profile/security/api-tokens"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    id.atlassian.com/manage-profile/security/api-tokens
                                </a>
                            </small>
                        </div>

                        {error && (
                            <div className="error-message">
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary"
                        >
                            {loading ? 'Linking...' : 'Link Account'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
