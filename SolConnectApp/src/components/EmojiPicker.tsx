import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  StyleSheet,
  Dimensions
} from 'react-native';
import { UserEmojiHistory } from '../types/chat';
import { getMessageBus } from '../services/MessageBus';
import { Logger } from '../services/monitoring/Logger';

interface EmojiPickerProps {
  visible: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
  currentUserAddress: string;
  theme?: 'light' | 'dark';
}

interface EmojiCategory {
  name: string;
  title: string;
  emojis: string[];
}

// Predefined emoji categories
const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'recent',
    title: 'Recently Used',
    emojis: [], // This will be populated from user history
  },
  {
    name: 'smileys',
    title: 'Smileys & People',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
      '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
      '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
      '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥',
      '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧',
      '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'
    ],
  },
  {
    name: 'nature',
    title: 'Animals & Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒',
      '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇',
      '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜',
      '🦟', '🦗', '🕷', '🕸', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕'
    ],
  },
  {
    name: 'food',
    title: 'Food & Drink',
    emojis: [
      '🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒',
      '🌶', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞',
      '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗',
      '🍖', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🌮', '🌯', '🥗'
    ],
  },
  {
    name: 'activities',
    title: 'Activities',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸',
      '🥌', '🎿', '⛷', '🏂', '🪂', '🏋', '🤼', '🤸', '⛹', '🤺',
      '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆'
    ],
  },
  {
    name: 'travel',
    title: 'Travel & Places',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑', '🚒', '🚐',
      '🛻', '🚚', '🚛', '🚜', '🏍', '🛵', '🚲', '🛴', '🛹', '🚁',
      '🛩', '✈️', '🛫', '🛬', '🪂', '💺', '🚀', '🛸', '🚉', '🚊',
      '🚝', '🚞', '🚋', '🚃', '🚟', '🚠', '🚡', '⛴', '🚢', '⛵',
      '🛶', '🚤', '🛥', '🛳', '⚓', '🏰', '🏯', '🏟', '🎡', '🎢'
    ],
  },
  {
    name: 'objects',
    title: 'Objects',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨', '🖥', '🖨', '🖱', '🖲', '🕹',
      '🗜', '💽', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥',
      '📽', '🎞', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙', '🎚',
      '🎛', '🧭', '⏱', '⏲', '⏰', '🕰', '⌛', '⏳', '📡', '🔋',
      '🔌', '💡', '🔦', '🕯', '🪔', '🧯', '🛢', '💸', '💵', '💴'
    ],
  },
];

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onEmojiSelect,
  onClose,
  currentUserAddress,
  theme = 'light'
}) => {
  const [selectedCategory, setSelectedCategory] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [recentEmojis, setRecentEmojis] = useState<UserEmojiHistory[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const logger = new Logger('EmojiPicker');

  useEffect(() => {
    if (visible && currentUserAddress) {
      loadRecentEmojis();
    }
  }, [visible, currentUserAddress]);

  const loadRecentEmojis = async () => {
    try {
      setIsLoading(true);
      const messageBus = getMessageBus();
      const result = await messageBus.getUserRecentEmojis(currentUserAddress, 16);
      
      if (result.success) {
        setRecentEmojis(result.data || []);
        
        // Update the recent category with user's recent emojis
        const recentCategory = EMOJI_CATEGORIES.find(cat => cat.name === 'recent');
        if (recentCategory) {
          recentCategory.emojis = result.data?.map(emoji => emoji.emoji) || [];
        }
      } else {
        logger.error('Failed to load recent emojis', result.error);
      }
    } catch (error) {
      logger.error('Error loading recent emojis', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    logger.debug('Emoji selected', { emoji });
    onEmojiSelect(emoji);
    onClose();
  };

  const getFilteredEmojis = () => {
    const category = EMOJI_CATEGORIES.find(cat => cat.name === selectedCategory);
    if (!category) return [];

    let emojis = category.emojis;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      emojis = emojis.filter(emoji => {
        // For now, simple matching. In a real app, you'd have emoji names/keywords
        return emoji.includes(query);
      });
    }

    return emojis;
  };

  const themedStyles = {
    modal: [
      styles.modal,
      theme === 'dark' ? styles.modalDark : styles.modalLight
    ],
    header: [
      styles.header,
      theme === 'dark' ? styles.headerDark : styles.headerLight
    ],
    title: [
      styles.title,
      theme === 'dark' ? styles.titleDark : styles.titleLight
    ],
    searchInput: [
      styles.searchInput,
      theme === 'dark' ? styles.searchInputDark : styles.searchInputLight
    ],
    categoryTab: [
      styles.categoryTab,
      theme === 'dark' ? styles.categoryTabDark : styles.categoryTabLight
    ],
    categoryTabActive: [
      styles.categoryTabActive,
      theme === 'dark' ? styles.categoryTabActiveDark : styles.categoryTabActiveLight
    ],
    categoryText: [
      styles.categoryText,
      theme === 'dark' ? styles.categoryTextDark : styles.categoryTextLight
    ],
    emojiGrid: [
      styles.emojiGrid,
      theme === 'dark' ? styles.emojiGridDark : styles.emojiGridLight
    ]
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={themedStyles.modal}>
          {/* Header */}
          <View style={themedStyles.header}>
            <Text style={themedStyles.title}>Choose an emoji</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search */}
          <TextInput
            style={themedStyles.searchInput}
            placeholder="Search emojis..."
            placeholderTextColor={theme === 'dark' ? '#999' : '#666'}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Category Tabs */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.categoryTabs}
          >
            {EMOJI_CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.name}
                style={[
                  themedStyles.categoryTab,
                  selectedCategory === category.name && themedStyles.categoryTabActive
                ]}
                onPress={() => setSelectedCategory(category.name)}
              >
                <Text style={themedStyles.categoryText}>
                  {category.title}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Emoji Grid */}
          <ScrollView style={themedStyles.emojiGrid}>
            <View style={styles.emojiContainer}>
              {getFilteredEmojis().map((emoji, index) => (
                <TouchableOpacity
                  key={`${emoji}-${index}`}
                  style={styles.emojiButton}
                  onPress={() => handleEmojiSelect(emoji)}
                >
                  <Text style={styles.emoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Recent emojis info */}
          {selectedCategory === 'recent' && recentEmojis.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={themedStyles.categoryText}>
                Your recently used emojis will appear here
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    height: height * 0.6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  modalLight: {
    backgroundColor: '#fff',
  },
  modalDark: {
    backgroundColor: '#1a1a1a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLight: {
    borderBottomColor: '#e0e0e0',
  },
  headerDark: {
    borderBottomColor: '#333',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  titleLight: {
    color: '#333',
  },
  titleDark: {
    color: '#fff',
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  searchInput: {
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
    borderWidth: 1,
  },
  searchInputLight: {
    backgroundColor: '#f5f5f5',
    borderColor: '#e0e0e0',
    color: '#333',
  },
  searchInputDark: {
    backgroundColor: '#2a2a2a',
    borderColor: '#404040',
    color: '#fff',
  },
  categoryTabs: {
    paddingLeft: 20,
    marginBottom: 16,
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 12,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryTabLight: {
    backgroundColor: 'transparent',
    borderColor: '#e0e0e0',
  },
  categoryTabDark: {
    backgroundColor: 'transparent',
    borderColor: '#404040',
  },
  categoryTabActive: {
    borderWidth: 2,
  },
  categoryTabActiveLight: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  categoryTabActiveDark: {
    backgroundColor: '#1a3a5c',
    borderColor: '#64b5f6',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  categoryTextLight: {
    color: '#333',
  },
  categoryTextDark: {
    color: '#fff',
  },
  emojiGrid: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emojiGridLight: {
    backgroundColor: 'transparent',
  },
  emojiGridDark: {
    backgroundColor: 'transparent',
  },
  emojiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  emojiButton: {
    width: (width - 60) / 8,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderRadius: 8,
  },
  emoji: {
    fontSize: 24,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
});

export default EmojiPicker;