/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { DocumentRecord } from './types/document';
import { documentService } from './services/documentService';
import { Dashboard } from './components/Dashboard';
import { SecurePdfViewer } from './components/SecurePdfViewer';
import { UploadModal } from './components/UploadModal';
import { ShareModal } from './components/ShareModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { EditSettingsModal } from './components/EditSettingsModal';
import { LoginPage } from './components/LoginPage';
import { authService } from './services/authService';
import { AuthUser } from './types/auth';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => authService.getCurrentUser());
  const [showLoginPage, setShowLoginPage] = useState<boolean>(false);
  const [isGuest, setIsGuest] = useState<boolean>(false);

  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Active viewer document ID (if viewing a document)
  const [activeViewerDocId, setActiveViewerDocId] = useState<string | null>(null);
  const [isOwnerPreview, setIsOwnerPreview] = useState<boolean>(false);

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState<boolean>(false);
  const [shareDoc, setShareDoc] = useState<DocumentRecord | null>(null);
  const [analyticsDoc, setAnalyticsDoc] = useState<DocumentRecord | null>(null);
  const [settingsDoc, setSettingsDoc] = useState<DocumentRecord | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<string>('all');
  const [uploadToast, setUploadToast] = useState<string | null>(null);

  // Inspect URL parameters for ?v=doc_xxx or path /v/xxx
  const checkUrlForViewer = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const vParam = params.get('v');
    if (vParam) {
      setActiveViewerDocId(vParam);
      return;
    }

    // Also check pathname format /v/:id
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'v' && pathParts[2]) {
      setActiveViewerDocId(pathParts[2]);
    }
  }, []);

  useEffect(() => {
    checkUrlForViewer();

    window.addEventListener('popstate', checkUrlForViewer);
    return () => {
      window.removeEventListener('popstate', checkUrlForViewer);
    };
  }, [checkUrlForViewer]);

  // Load documents for Dashboard
  const loadDocuments = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const docs = await documentService.getDocuments();
      setDocuments(docs);
    } catch (err) {
      console.warn('Failed to fetch documents', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocuments();

    // Automatically refresh shared documents from the server on focus and every 8 seconds
    // so all users immediately see newly uploaded or synced PDFs without manual reload
    const handleFocus = () => {
      loadDocuments(true);
    };
    window.addEventListener('focus', handleFocus);
    const intervalId = window.setInterval(() => {
      loadDocuments(true);
    }, 8000);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [loadDocuments]);

  const isAdmin = Boolean(currentUser && (currentUser.role === 'admin' || currentUser.isOwner));

  // Upload handler - no separate link modal prompted after upload
  const handleUploaded = async (data: any) => {
    if (!isAdmin) return;
    const created = await documentService.createDocument(data);
    await loadDocuments();
    if (created?.folder) {
      setSelectedFolder(created.folder);
      setUploadToast(`✓ Successfully uploaded "${created.title}" to folder "${created.folder}"!`);
      setTimeout(() => setUploadToast(null), 5000);
    } else {
      setSelectedFolder('all');
    }
  };

  // Seed sample handler
  const handleSeedSample = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      await documentService.seedDemoDocument();
      await loadDocuments();
    } finally {
      setLoading(false);
    }
  };

  // Bundle all unique PDFs into one final master link
  const handleBundleAll = async () => {
    if (!isAdmin) return;
    try {
      setLoading(true);
      const master = await documentService.bundleAllDocuments();
      await loadDocuments();
      setShareDoc(master);
    } catch (err) {
      console.warn('Failed to bundle all documents', err);
    } finally {
      setLoading(false);
    }
  };

  // Toggle active status
  const handleToggleActive = async (docId: string, currentActive: boolean) => {
    if (!isAdmin) return;
    await documentService.updateDocument(docId, { isActive: !currentActive });
    await loadDocuments();
  };

  // Update settings handler
  const handleSaveSettings = async (docId: string, updates: any) => {
    if (!isAdmin) return;
    await documentService.updateDocument(docId, updates);
    await loadDocuments();
  };

  // Delete document handler
  const handleDeleteDocument = async (docId: string) => {
    if (!isAdmin) return;
    await documentService.deleteDocument(docId);
    await loadDocuments();
  };

  // Delete individual file from document handler
  const handleDeleteFile = async (docId: string, fileId: string) => {
    if (!isAdmin) return;
    await documentService.deleteFileFromDocument(docId, fileId);
    await loadDocuments();
  };

  // Open viewer mode
  const handleOpenViewer = (docId: string, ownerPreview = false) => {
    setIsOwnerPreview(ownerPreview);
    setActiveViewerDocId(docId);
    // Update URL query parameter
    const newUrl = `${window.location.pathname}?v=${docId}`;
    window.history.pushState({ docId }, '', newUrl);
  };

  // Auth handlers
  const handleLoginSuccess = (user: AuthUser) => {
    setCurrentUser(user);
    setShowLoginPage(false);
    setIsGuest(false);
    setSelectedFolder('all');
    loadDocuments();
  };

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
    setIsGuest(false);
    setShowLoginPage(true);
  };

  // Exit viewer back to dashboard
  const handleExitViewer = () => {
    setActiveViewerDocId(null);
    setIsOwnerPreview(false);
    // Remove query param from URL
    window.history.pushState({}, '', window.location.pathname);
    loadDocuments();
  };

  // If a document ID is selected or in URL, display the Secure View-Only Reader!
  if (activeViewerDocId) {
    return (
      <SecurePdfViewer
        documentId={activeViewerDocId}
        onExit={handleExitViewer}
        isOwnerPreview={isOwnerPreview}
      />
    );
  }

  // If unauthenticated or login page requested, show the Login Page
  if ((!currentUser && !isGuest) || showLoginPage) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        onContinueAsGuest={() => {
          setIsGuest(true);
          setShowLoginPage(false);
          setSelectedFolder('all');
          loadDocuments();
        }}
      />
    );
  }

  // Otherwise, show the Document Owner Dashboard
  return (
    <>
      <Dashboard
        documents={documents}
        loading={loading}
        selectedFolder={selectedFolder}
        onSelectFolder={setSelectedFolder}
        recentUploadToast={uploadToast}
        onUploadClick={() => setIsUploadOpen(true)}
        onSeedSampleClick={handleSeedSample}
        onBundleAllClick={handleBundleAll}
        onShareClick={(doc) => setShareDoc(doc)}
        onAnalyticsClick={(doc) => setAnalyticsDoc(doc)}
        onSettingsClick={(doc) => setSettingsDoc(doc)}
        onPreviewClick={(docId) => handleOpenViewer(docId, true)}
        onToggleActive={handleToggleActive}
        onDeleteDocument={handleDeleteDocument}
        onDeleteFile={handleDeleteFile}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLogin={() => setShowLoginPage(true)}
        onSwitchUser={(user) => {
          authService.setCurrentUser(user);
          setCurrentUser(user);
        }}
        onReloadDocuments={loadDocuments}
      />

      {/* Upload Modal (Admins Only) */}
      {isAdmin && (
        <UploadModal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          onUploaded={handleUploaded}
          currentUser={currentUser}
          initialFolder={selectedFolder}
        />
      )}

      {/* Share Modal */}
      <ShareModal
        document={shareDoc}
        isOpen={Boolean(shareDoc)}
        onClose={() => setShareDoc(null)}
        onOpenViewer={(docId) => {
          setShareDoc(null);
          handleOpenViewer(docId, true);
        }}
      />

      {/* Analytics Modal */}
      <AnalyticsModal
        document={analyticsDoc}
        isOpen={Boolean(analyticsDoc)}
        onClose={() => setAnalyticsDoc(null)}
      />

      {/* Edit Settings Modal (Admins Only) */}
      {isAdmin && (
        <EditSettingsModal
          document={settingsDoc}
          isOpen={Boolean(settingsDoc)}
          onClose={() => setSettingsDoc(null)}
          onSave={handleSaveSettings}
          onDelete={handleDeleteDocument}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
