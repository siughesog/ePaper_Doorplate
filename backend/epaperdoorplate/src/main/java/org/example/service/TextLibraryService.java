package org.example.service;

import org.example.dto.TextLibraryDto;
import org.example.model.TextLibraryItem;
import org.example.repository.TextLibraryRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class TextLibraryService {
    
    private final TextLibraryRepository textLibraryRepository;
    
    public TextLibraryService(TextLibraryRepository textLibraryRepository) {
        this.textLibraryRepository = textLibraryRepository;
    }
    
    public List<TextLibraryDto> getTextLibraryByUserId(String userId) {
        List<TextLibraryItem> items = textLibraryRepository.findByUserId(userId);
        return items.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    public List<TextLibraryDto> getTextLibraryByUserIdAndElementId(String userId, String elementId) {
        List<TextLibraryItem> items = textLibraryRepository.findByUserIdAndElementId(userId, elementId);
        return items.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    public TextLibraryDto saveTextLibraryItem(String userId, TextLibraryDto dto) {
        TextLibraryItem item;
        
        if (dto.getId() != null && !dto.getId().isEmpty()) {
            // 更新現有項目
            Optional<TextLibraryItem> existingOpt = textLibraryRepository.findById(dto.getId());
            if (existingOpt.isPresent()) {
                item = existingOpt.get();
                updateItemFromDto(item, dto);
            } else {
                item = createNewItem(userId, dto);
            }
        } else {
            // 創建新項目
            item = createNewItem(userId, dto);
        }
        
        item.setUpdatedAt(Instant.now());
        TextLibraryItem savedItem = textLibraryRepository.save(item);
        return convertToDto(savedItem);
    }
    
    public boolean deleteTextLibraryItem(String userId, String textId) {
        try {
            textLibraryRepository.deleteByUserIdAndId(userId, textId);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    public Optional<TextLibraryDto> getTextLibraryItemById(String textId) {
        return textLibraryRepository.findById(textId)
                .map(this::convertToDto);
    }
    
    private TextLibraryItem createNewItem(String userId, TextLibraryDto dto) {
        TextLibraryItem item = new TextLibraryItem();
        item.setUserId(userId);
        item.setCreatedAt(Instant.now());
        updateItemFromDto(item, dto);
        return item;
    }
    
    private void updateItemFromDto(TextLibraryItem item, TextLibraryDto dto) {
        item.setText(dto.getText());
        item.setElementId(dto.getElementId());
        item.setDescription(dto.getDescription());
        item.setTags(dto.getTags());
    }
    
    private TextLibraryDto convertToDto(TextLibraryItem item) {
        TextLibraryDto dto = new TextLibraryDto();
        dto.setId(item.getId());
        dto.setText(item.getText());
        dto.setElementId(item.getElementId());
        dto.setDescription(item.getDescription());
        dto.setTags(item.getTags());
        return dto;
    }
}
