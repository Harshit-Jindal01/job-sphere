import React from 'react';
import { Heart, ChatCircle, Clock } from '@phosphor-icons/react';

export default function PostCard({
  post,
  user,
  index,
  expandedComments,
  setExpandedComments,
  comments,
  setComments,
  commentTexts,
  setCommentTexts,
  isLiking,
  setIsLiking,
  isCommenting,
  setIsCommenting,
  isLoadingComments,
  setIsLoadingComments,
  handleLikePost,
  toggleComments,
  loadComments,
  handleAddComment,
  formatPostTime
}) {
  const isLiked = post.likes?.includes(user?.uid);
  const likeCount = post.likes?.length || 0;
  const commentCount = post.commentCount || 0;
  const postComments = comments[post.id] || [];

  return (
    <div className="post-card">
      <div className="post-header">
        <div className="post-avatar">
          <img
            src={post.authorPhoto || 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'}
            alt={post.authorName || 'User'}
            style={{ width: '48px', height: '48px', borderRadius: '50%' }}
          />
        </div>
        <div className="post-info">
          <h4>{post.authorName || 'Unknown'}</h4>
          <p style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Clock style={{ fontSize: '0.8rem' }} /> {formatPostTime(post.createdAt)}
          </p>
        </div>
      </div>
      <div className="post-content">
        <p>{post.content || post.text}</p>
      </div>
      {post.imageUrl && (
        <div className="post-image">
          <img src={post.imageUrl} alt="Post image" />
        </div>
      )}
      <div className="post-actions">
        <span className="likes">
          <Heart style={{ color: '#ef4444' }} /> {likeCount}
        </span>
        <span className="comments" onClick={() => toggleComments(post.id)}>
          <ChatCircle /> {commentCount}
        </span>
      </div>
      <div className="post-interactions">
        <button 
          onClick={() => handleLikePost(post.id)}
          disabled={isLiking[post.id]}
        >
          {isLiked ? 'Liked' : 'Like'}
        </button>
        <button 
          onClick={() => toggleComments(post.id)}
        >
          Comment
        </button>
      </div>
      {expandedComments[post.id] && (
        <div className="comments-section" id={`comments-${post.id}`}>
          <div className="comments-list">
            {isLoadingComments[post.id] ? (
              <p>Loading comments...</p>
            ) : postComments.length > 0 ? (
              postComments.map((comment) => (
                <div className="comment" key={comment.id}>
                  <div className="comment-avatar">
                    <img
                      src={comment.authorPhoto || 'https://ui-avatars.com/api/?name=User&background=6366f1&color=fff'}
                      alt={comment.authorName || 'User'}
                      style={{ width: '36px', height: '36px', borderRadius: '50%' }}
                    />
                  </div>
                  <div className="comment-content">
                    <h4>{comment.authorName || 'Unknown'}</h4>
                    <p>{comment.text}</p>
                    <small>{formatPostTime(comment.createdAt)}</small>
                  </div>
                </div>
              ))
            ) : (
              <p>No comments yet. Be the first!</p>
            )}
          </div>
          <div className="add-comment">
            <input
              type="text"
              value={commentTexts[post.id] || ''}
              onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
              onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
              placeholder="Write a comment..."
              disabled={isCommenting[post.id]}
            />
            <button
              onClick={() => handleAddComment(post.id)}
              disabled={isCommenting[post.id] || !commentTexts[post.id]?.trim()}
            >
              {isCommenting[post.id] ? 'Posting...' : 'Post'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}