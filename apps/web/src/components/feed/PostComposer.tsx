
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  BarChart2,
  Globe,
  Image,
  Loader2,
  Lock,
  Plus,
  Send,
  Users,
  X,
} from 'lucide-react'

import {
  postsApi,
  type PostItem,
  type PostMedia,
  type PostVisibility,
} from '../../api/posts'
import { communityApi } from '../../api/community'
import { useAuth } from '../../hooks/useAuth'
import { safeRandomUUID } from '../../utils/uuid'

import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { MentionTextarea } from '../ui/MentionTextarea'

interface PostComposerProps {
  onPostCreated?: (newPost: PostItem) => void
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024 // 10 MB

export function PostComposer({ onPostCreated }: PostComposerProps) {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  const [content, setContent] = useState('')
  const [visibility, setVisibility] =
    useState<PostVisibility>('PUBLIC')

  const [mediaList, setMediaList] = useState<PostMedia[]>([])
  const [isUploadingMedia, setIsUploadingMedia] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Poll state
  const [isCreatingPoll, setIsCreatingPoll] = useState(false)
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const idempotencyKeyRef = useRef<string>(safeRandomUUID())

  /*
   * Create post mutation
   */
  const createPostMutation = useMutation({
    mutationFn: async (payload: {
      content: string
      visibility: PostVisibility
      mediaUploadIds?: string[]
      idempotencyKey: string
    }) => {
      let pollId: string | undefined

      const validPollOptions = pollOptions.filter(
        (option) => option.trim().length > 0,
      )

      if (isCreatingPoll && validPollOptions.length >= 2) {
        const pollQuestion =
          content.trim().substring(0, 255) || 'Poll'

        const poll = await communityApi.createPoll({
          question: pollQuestion,
          options: validPollOptions,
        })

        pollId = poll.id
      }

      return postsApi.createPost({
        ...payload,
        pollId,
      })
    },

    onSuccess: (newPost) => {
      setContent('')
      setMediaList([])
      setUploadError(null)

      setIsCreatingPoll(false)
      setPollOptions(['', ''])

      /*
       * Insert the newly created post into the existing feed cache
       * instead of forcing a complete refetch.
       */
      queryClient.setQueriesData(
        { queryKey: ['feed'] },
        (old: any) => {
          if (!old?.pages?.length) {
            return old
          }

          const newPages = [...old.pages]

          newPages[0] = {
            ...newPages[0],
            items: [newPost, ...newPages[0].items],
          }

          return {
            ...old,
            pages: newPages,
          }
        },
      )

      onPostCreated?.(newPost)
    },
  })

  /*
   * Media upload
   */
  const handleFileChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0]

    if (!file) {
      return
    }

    const isImage = file.type.startsWith('image/')

    if (!isImage) {
      setUploadError('Only images are supported')
      return
    }

    if (file.size > MAX_IMAGE_SIZE) {
      setUploadError('Images must be under 10 MB')
      return
    }

    setUploadError(null)
    setIsUploadingMedia(true)

    try {
      const media = await postsApi.uploadMedia(file)

      setMediaList((prev) => [...prev, media])
    } catch (err: any) {
      setUploadError(
        err?.message || 'Failed to upload media',
      )
    } finally {
      setIsUploadingMedia(false)

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  /*
   * Remove uploaded media
   */
  const removeMedia = (
    target: PostMedia,
    index: number,
  ) => {
    setMediaList((prev) =>
      prev.filter((media, mediaIndex) =>
        media.id
          ? media.id !== target.id
          : mediaIndex !== index,
      ),
    )
  }

  /*
   * Submit post
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (
      (!content.trim() && mediaList.length === 0) ||
      createPostMutation.isPending
    ) {
      return
    }

    const currentKey = idempotencyKeyRef.current

    // Generate the next key immediately so every future submission
    // receives a fresh idempotency key.
    idempotencyKeyRef.current = safeRandomUUID()

    const validMediaIds = mediaList
      .map((media: any) => media.uploadId || media.id)
      .filter(
        (id): id is string =>
          typeof id === 'string' &&
          id.trim().length > 0,
      )

    createPostMutation.mutate({
      content: content.trim(),
      visibility,
      mediaUploadIds:
        validMediaIds.length > 0
          ? validMediaIds
          : undefined,
      idempotencyKey: currentKey,
    })
  }

  /*
   * Submit state
   */
  const validPollOptionCount = pollOptions.filter(
    (option) => option.trim().length > 0,
  ).length

  const canSubmit =
    !createPostMutation.isPending &&
    !isUploadingMedia &&
    (
      content.trim().length > 0 ||
      mediaList.length > 0 ||
      (isCreatingPoll && validPollOptionCount >= 2)
    )

  return (
    <div className="mb-0 border-b border-border-subtle bg-surface px-4 py-4 sm:mb-2 sm:bg-transparent sm:px-1 sm:py-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        {/* Author + Composer */}
        <div className="flex gap-3">
          <Avatar
            src={user?.avatarUrl}
            alt={
              user?.displayName ||
              user?.fullName ||
              'User'
            }
            name={
              user?.displayName ||
              user?.fullName ||
              'S'
            }
          />

          <div className="min-w-0 flex-1">
            <MentionTextarea
              rows={3}
              value={content}
              onChangeValue={setContent}
              placeholder="What's happening on campus? Type @ to tag someone..."
              className="w-full resize-none border-none bg-transparent text-[15px] leading-relaxed text-foreground outline-none placeholder:text-foreground-subtle focus:ring-0"
              containerClassName="w-full"
            />
          </div>
        </div>

        {/* Media previews */}
        {mediaList.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2 sm:grid-cols-3">
            {mediaList.map((item, index) => (
              <div
                key={
                  item.id ||
                  item.url ||
                  `media - ${index} `
                }
                className="group relative aspect-video overflow-hidden rounded-lg border border-border bg-surface-muted"
              >
                {item.type === 'VIDEO' ? (
                  <video
                    src={item.url}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <img
                    src={item.url}
                    alt="Uploaded media"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                )}

                <button
                  type="button"
                  onClick={() =>
                    removeMedia(item, index)
                  }
                  className="absolute right-1 top-1 rounded-full bg-background/80 p-1 text-foreground transition-colors hover:bg-background"
                  aria-label="Remove media"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Upload state */}
        {isUploadingMedia && (
          <div className="flex items-center gap-2 pt-1 text-xs text-primary">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Uploading media...</span>
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <p
            className="pt-1 text-xs text-danger"
            role="alert"
          >
            {uploadError}
          </p>
        )}

        {/* Post creation error */}
        {createPostMutation.isError && (
          <p
            className="pt-1 text-xs text-danger"
            role="alert"
          >
            {createPostMutation.error.message ||
              'Failed to create post'}
          </p>
        )}

        {/* Poll composer */}
        {isCreatingPoll && (
          <div className="mt-2 space-y-3 rounded-xl border border-border bg-surface-muted/50 p-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-foreground">
                Poll Options
              </h4>

              <button
                type="button"
                onClick={() => {
                  setIsCreatingPoll(false)
                  setPollOptions(['', ''])
                }}
                className="rounded-lg p-1 text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
                aria-label="Close poll"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {pollOptions.map((option, index) => (
                <div
                  key={`poll - opt - ${index} `}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => {
                      const newOptions = [
                        ...pollOptions,
                      ]

                      newOptions[index] =
                        e.target.value

                      setPollOptions(newOptions)
                    }}
                    placeholder={`Option ${index + 1} `}
                    className="hk-input h-9 min-w-0 flex-1 text-sm"
                    maxLength={50}
                  />

                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setPollOptions(
                          pollOptions.filter(
                            (_, optionIndex) =>
                              optionIndex !== index,
                          ),
                        )
                      }
                      className="shrink-0 rounded-lg p-1.5 text-foreground-muted transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label={`Remove option ${index + 1} `}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 5 && (
              <button
                type="button"
                onClick={() =>
                  setPollOptions([
                    ...pollOptions,
                    '',
                  ])
                }
                className="mt-2 flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
              >
                <Plus className="h-4 w-4" />
                Add option
              </button>
            )}
          </div>
        )}

        {/* Action bar */}
        <div className="flex items-center justify-between gap-2 pt-1">
          {/* Left actions */}
          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-hidden sm:gap-1">
            {/* File input */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
              id="composer-file-input"
            />

            {/* Media */}
            <label
              htmlFor="composer-file-input"
              className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-foreground-muted transition-all hover:bg-surface-muted hover:text-foreground active:scale-95 sm:gap-1.5 sm:px-2.5"
            >
              <Image className="h-4 w-4 text-primary" />

              <span className="hidden sm:inline">
                Media
              </span>
            </label>

            {/* Poll */}
            <button
              type="button"
              onClick={() =>
                setIsCreatingPoll(
                  !isCreatingPoll,
                )
              }
              className={`flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium transition-all active:scale-95 sm:gap-1.5 sm:px-2.5 ${
                isCreatingPoll
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground-muted hover:bg-surface-muted hover:text-foreground'
              }`}
            >
              <BarChart2
                className={`h-4 w-4 ${
                  isCreatingPoll
                    ? 'text-primary'
                    : 'text-secondary'
                }`}
              />

              <span className="hidden sm:inline">
                Poll
              </span>
            </button>

            {/* Visibility */}
            <div className="relative shrink-0">
              <select
                value={visibility}
                onChange={(e) =>
                  setVisibility(
                    e.target.value as PostVisibility,
                  )
                }
                className="h-8 max-w-[82px] appearance-none rounded-lg border border-border bg-surface pl-2 pr-6 text-xs font-medium text-foreground focus:border-focus focus:outline-none sm:h-auto sm:max-w-none sm:py-1.5"
                aria-label="Post visibility"
              >
                <option value="PUBLIC">
                  Public
                </option>

                <option value="CONNECTIONS_ONLY">
                  Connections
                </option>

                <option value="PRIVATE">
                  Only Me
                </option>
              </select>

              <div className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-foreground-muted">
                {visibility === 'PUBLIC' && (
                  <Globe className="h-3 w-3" />
                )}

                {visibility ===
                  'CONNECTIONS_ONLY' && (
                    <Users className="h-3 w-3" />
                  )}

                {visibility === 'PRIVATE' && (
                  <Lock className="h-3 w-3" />
                )}
              </div>
            </div>
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={!canSubmit}
            loading={createPostMutation.isPending}
            size="sm"
            className="shrink-0"
          >
            {createPostMutation.isPending ? (
              'Posting...'
            ) : (
              <>
                <span>Post</span>
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

