import React, { useState } from 'react';
import { integrationsApi } from '../../services/integrationsApi';
import { useAuth } from '../../contexts/AuthContext';
import './LinkAtlassianModal.css';   // reuse the same modal CSS — visually identical shell

interface LinkLucidModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    isUpdateMode?: boolean;
}

/**
 * Modal that lets the user paste their personal Lucid REST API key.
 *
 * Mirrors LinkAtlassianModal's UX: single-field form (the API key), submit
 * calls /api/integrations/lucid/link which validates the key against
 * Lucid's /users/me and stores it KMS-encrypted on the users table.
 */
export const LinkLucidModal: React.FC<LinkLucidModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    isUpdateMode = false,
}) => {
    const { accessToken } = useAuth();

    const [apiKey, setApiKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    React.useEffect(() => {
        if (isOpen) {
            setApiKey('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!accessToken) {
            setError('You must be logged in to link your Lucid API key.');
            setLoading(false);
            return;
        }

        try {
            await integrationsApi.linkLucidAccount({ api_key: apiKey.trim() }, accessToken);
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(
                err.response?.data?.detail ||
                'Failed to verify the API key. Please double-check it and try again.'
            );
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2>{isUpdateMode ? 'Update Lucid API Key' : 'Link Lucid Account'}</h2>
                        <p style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px', fontWeight: 400 }}>
                            {isUpdateMode
                                ? 'Enter your new key to replace the existing one'
                                : 'Connect your Lucid account so we can import diagrams you generate in Lucid AI'}
                        </p>
                    </div>
                    <button className="close-button" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        <div className="form-group">
                            <label htmlFor="lucidApiKey">
                                {isUpdateMode ? 'New API Key' : 'Lucid REST API Key'}
                            </label>
                            <input
                                id="lucidApiKey"
                                type="password"
                                placeholder="key-..."
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                required
                                disabled={loading}
                                autoComplete="off"
                                spellCheck={false}
                            />
                            <small className="form-hint">
                                Generate at:{' '}
                                <a
                                    href="https://lucid.app/users/settings#/apps/developer/api-keys"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    lucid.app · Account Settings · API Keys
                                </a>
                                . The key starts with <code>key-</code>. We store it encrypted at rest.
                            </small>
                        </div>

                        {error && <div className="error-message">{error}</div>}
                    </div>

                    <div className="modal-footer">
                        <button type="button" onClick={onClose} disabled={loading} className="btn-secondary">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading
                                ? (isUpdateMode ? 'Updating...' : 'Linking...')
                                : (isUpdateMode ? 'Update Key' : 'Link Account')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
