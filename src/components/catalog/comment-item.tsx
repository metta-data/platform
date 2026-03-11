"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pin, CheckCircle2, XCircle, Pencil, Trash2, MessageSquare } from "lucide-react";

interface Author {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Comment {
  id: string;
  body: string;
  author: Author;
  isPinned: boolean;
  isResolved: boolean;
  resolvedBy: { id: string; username: string; displayName: string | null } | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
  replies?: Comment[];
}

interface CommentItemProps {
  comment: Comment;
  currentUserId: string | undefined;
  canModerate: boolean;
  isAdmin: boolean;
  isReply?: boolean;
  onReply?: (parentId: string) => void;
  onEdit: (commentId: string, newBody: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onResolve?: (commentId: string, resolved: boolean) => Promise<void>;
  onPin?: (commentId: string, pinned: boolean) => Promise<void>;
}

export function CommentItem({
  comment,
  currentUserId,
  canModerate,
  isAdmin,
  isReply = false,
  onReply,
  onEdit,
  onDelete,
  onResolve,
  onPin,
}: CommentItemProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [saving, setSaving] = useState(false);

  const isOwner = currentUserId === comment.author.id;
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin;
  const authorName = comment.author.displayName || comment.author.username;

  const handleSaveEdit = async () => {
    if (!editBody.trim() || saving) return;
    setSaving(true);
    try {
      await onEdit(comment.id, editBody.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={`${isReply ? "ml-6 border-l-2 border-muted pl-4" : ""} ${
        comment.isPinned && !isReply ? "bg-amber-50/50 dark:bg-amber-950/20 rounded-md p-2 -mx-2" : ""
      }`}
    >
      <div className="flex items-start gap-2">
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={authorName}
            className="h-6 w-6 rounded-full mt-0.5"
          />
        ) : (
          <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center mt-0.5">
            <span className="text-xs font-medium">
              {authorName.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{authorName}</span>
            <span className="text-xs text-muted-foreground">
              {new Date(comment.createdAt).toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            {comment.isPinned && (
              <Pin className="h-3 w-3 text-amber-500" />
            )}
          </div>

          {editing ? (
            <div className="mt-1 space-y-2">
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
              />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveEdit} disabled={saving}>
                  {saving ? "Saving..." : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-0.5 text-sm whitespace-pre-wrap">{comment.body}</p>
          )}

          {/* Action buttons */}
          {!editing && (
            <div className="flex items-center gap-1 mt-1">
              {!isReply && onReply && currentUserId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => onReply(comment.id)}
                >
                  <MessageSquare className="h-3 w-3 mr-1" />
                  Reply
                </Button>
              )}
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => {
                    setEditBody(comment.body);
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit
                </Button>
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-destructive"
                  onClick={() => onDelete(comment.id)}
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Delete
                </Button>
              )}
              {!isReply && canModerate && onResolve && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => onResolve(comment.id, !comment.isResolved)}
                >
                  {comment.isResolved ? (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Reopen
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Resolve
                    </>
                  )}
                </Button>
              )}
              {!isReply && canModerate && onPin && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground"
                  onClick={() => onPin(comment.id, !comment.isPinned)}
                >
                  <Pin className="h-3 w-3 mr-1" />
                  {comment.isPinned ? "Unpin" : "Pin"}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
