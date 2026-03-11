"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Loader2, ChevronRight, CheckCircle2 } from "lucide-react";
import { CommentItem } from "./comment-item";

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

interface CatalogCommentsProps {
  tableName: string;
  element: string;
  currentUserId: string | undefined;
  userRole: string | undefined;
}

export function CatalogComments({
  tableName,
  element,
  currentUserId,
  userRole,
}: CatalogCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [posting, setPosting] = useState(false);

  const canModerate = userRole === "STEWARD" || userRole === "ADMIN";
  const isAdmin = userRole === "ADMIN";
  const canComment = !!currentUserId;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/catalog/${encodeURIComponent(tableName)}/${encodeURIComponent(element)}/comments`
      );
      if (res.ok) {
        setComments(await res.json());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [tableName, element]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handlePost = async (parentId?: string) => {
    const body = parentId ? replyBody : newComment;
    if (!body.trim() || posting) return;

    setPosting(true);
    try {
      const res = await fetch(
        `/api/catalog/${encodeURIComponent(tableName)}/${encodeURIComponent(element)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            body: body.trim(),
            parentId: parentId || undefined,
          }),
        }
      );
      if (res.ok) {
        if (parentId) {
          setReplyBody("");
          setReplyingTo(null);
        } else {
          setNewComment("");
        }
        fetchComments();
      }
    } finally {
      setPosting(false);
    }
  };

  const handleEdit = async (commentId: string, newBody: string) => {
    const res = await fetch(`/api/catalog/comments/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: newBody }),
    });
    if (res.ok) fetchComments();
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm("Delete this comment?")) return;
    const res = await fetch(`/api/catalog/comments/${commentId}`, {
      method: "DELETE",
    });
    if (res.ok) fetchComments();
  };

  const handleResolve = async (commentId: string, resolved: boolean) => {
    const res = await fetch(`/api/catalog/comments/${commentId}/resolve`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved }),
    });
    if (res.ok) fetchComments();
  };

  const handlePin = async (commentId: string, pinned: boolean) => {
    const res = await fetch(`/api/catalog/comments/${commentId}/pin`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned }),
    });
    if (res.ok) fetchComments();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const openComments = comments.filter((c) => !c.isResolved);
  const resolvedComments = comments.filter((c) => c.isResolved);

  return (
    <div className="space-y-4">
      {/* New comment form */}
      {canComment && (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
            rows={2}
            placeholder="Add a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={() => handlePost()}
              disabled={posting || !newComment.trim()}
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Posting...
                </>
              ) : (
                "Comment"
              )}
            </Button>
          </div>
        </div>
      )}

      {comments.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4">
          No comments yet.{" "}
          {canComment
            ? "Be the first to add one."
            : "Sign in to start a discussion."}
        </p>
      )}

      {/* Open comments */}
      {openComments.map((comment) => (
        <div key={comment.id} className="space-y-2">
          <CommentItem
            comment={comment}
            currentUserId={currentUserId}
            canModerate={canModerate}
            isAdmin={isAdmin}
            onReply={(parentId) => {
              setReplyingTo(parentId);
              setReplyBody("");
            }}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onResolve={handleResolve}
            onPin={handlePin}
          />

          {/* Replies */}
          {comment.replies?.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              canModerate={canModerate}
              isAdmin={isAdmin}
              isReply
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}

          {/* Reply form */}
          {replyingTo === comment.id && (
            <div className="ml-6 space-y-2">
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                rows={2}
                placeholder="Write a reply..."
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setReplyingTo(null)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handlePost(comment.id)}
                  disabled={posting || !replyBody.trim()}
                >
                  Reply
                </Button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Resolved comments */}
      {resolvedComments.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full group">
            <ChevronRight className="h-4 w-4 transition-transform group-data-[state=open]:rotate-90" />
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span>
              {resolvedComments.length} resolved{" "}
              {resolvedComments.length === 1 ? "thread" : "threads"}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-2 space-y-2 opacity-60">
            {resolvedComments.map((comment) => (
              <div key={comment.id} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary" className="text-[10px]">
                    Resolved
                  </Badge>
                  {comment.resolvedBy && (
                    <span>
                      by{" "}
                      {comment.resolvedBy.displayName ||
                        comment.resolvedBy.username}
                    </span>
                  )}
                </div>
                <CommentItem
                  comment={comment}
                  currentUserId={currentUserId}
                  canModerate={canModerate}
                  isAdmin={isAdmin}
                  onReply={(parentId) => {
                    setReplyingTo(parentId);
                    setReplyBody("");
                  }}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onResolve={handleResolve}
                  onPin={handlePin}
                />
                {comment.replies?.map((reply) => (
                  <CommentItem
                    key={reply.id}
                    comment={reply}
                    currentUserId={currentUserId}
                    canModerate={canModerate}
                    isAdmin={isAdmin}
                    isReply
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
