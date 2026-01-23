import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useState,
  useCallback,
} from "react";
import { Box, Text, useStdout } from "ink";
import { ScrollView, type ScrollViewRef } from "ink-scroll-view";
import { ScrollBar } from "@byteland/ink-scroll-bar";
import type { ChatMessage } from "../../providers/types.js";
import { MessageItem } from "./message-item.js";
import { AssistantMessage } from "./assistant-message.js";

export interface ScrollableMessageListRef {
  scrollBy: (delta: number) => void;
  scrollToBottom: () => void;
  scrollToTop: () => void;
}

interface ScrollableMessageListProps {
  messages: ChatMessage[];
  height: number;
  isStreaming?: boolean;
  streamingContent?: string;
}

export const ScrollableMessageList = forwardRef<
  ScrollableMessageListRef,
  ScrollableMessageListProps
>(({ messages, height, isStreaming = false, streamingContent = "" }, ref) => {
  const scrollRef = useRef<ScrollViewRef>(null);
  const { stdout } = useStdout();
  const prevLengthRef = useRef(messages.length);

  const [scrollState, setScrollState] = useState({
    contentHeight: 0,
    viewportHeight: 0,
    scrollOffset: 0,
  });

  const updateScrollState = useCallback(() => {
    if (scrollRef.current) {
      setScrollState({
        contentHeight: scrollRef.current.getContentHeight() || 0,
        viewportHeight: scrollRef.current.getViewportHeight() || 0,
        scrollOffset: scrollRef.current.getScrollOffset() || 0,
      });
    }
  }, []);

  useImperativeHandle(ref, () => ({
    scrollBy: (delta: number) => {
      if (!scrollRef.current) return;

      const currentOffset = scrollRef.current.getScrollOffset() || 0;
      const contentHeight = scrollRef.current.getContentHeight() || 0;
      const viewportHeight = scrollRef.current.getViewportHeight() || 0;
      const maxOffset = Math.max(0, contentHeight - viewportHeight);

      const newOffset = Math.max(0, Math.min(maxOffset, currentOffset + delta));
      scrollRef.current.scrollTo(newOffset);
      setTimeout(updateScrollState, 10);
    },
    scrollToBottom: () => {
      scrollRef.current?.scrollToBottom();
      setTimeout(updateScrollState, 10);
    },
    scrollToTop: () => {
      scrollRef.current?.scrollToTop();
      setTimeout(updateScrollState, 10);
    },
  }));

  useEffect(() => {
    if (messages.length > prevLengthRef.current) {
      setTimeout(() => {
        scrollRef.current?.remeasure();
        scrollRef.current?.scrollToBottom();
        updateScrollState();
      }, 50);
    }
    prevLengthRef.current = messages.length;
  }, [messages.length, updateScrollState]);

  useEffect(() => {
    const handleResize = () => {
      scrollRef.current?.remeasure();
      updateScrollState();
    };
    stdout?.on("resize", handleResize);
    return () => {
      stdout?.off("resize", handleResize);
    };
  }, [stdout, updateScrollState]);

  // Auto-scroll when streaming content updates
  useEffect(() => {
    if (isStreaming && streamingContent) {
      scrollRef.current?.remeasure();
      scrollRef.current?.scrollToBottom();
      updateScrollState();
    }
  }, [isStreaming, streamingContent, updateScrollState]);

  if (messages.length === 0) {
    return (
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        padding={1}
        height={height}
        justifyContent="center"
        alignItems="center"
      >
        <Text color="gray" italic>
          No messages yet. Start a conversation!
        </Text>
      </Box>
    );
  }

  const showScrollBar = scrollState.contentHeight > scrollState.viewportHeight;
  const innerHeight = height - 2;

  return (
    <Box flexDirection="row" height={height}>
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor="gray"
        borderRight={showScrollBar ? false : true}
        padding={1}
        flexGrow={1}
        overflow="hidden"
      >
        <ScrollView ref={scrollRef}>
          {messages.map((message) => (
            <MessageItem key={message.id} message={message} />
          ))}
          {isStreaming && (
            <AssistantMessage
              content={streamingContent || "▊"}
              isStreaming
            />
          )}
        </ScrollView>
      </Box>
      {showScrollBar && (
        <ScrollBar
          placement="right"
          style="single"
          contentHeight={scrollState.contentHeight}
          viewportHeight={innerHeight}
          scrollOffset={scrollState.scrollOffset}
          color="white"
        />
      )}
    </Box>
  );
});

ScrollableMessageList.displayName = "ScrollableMessageList";
