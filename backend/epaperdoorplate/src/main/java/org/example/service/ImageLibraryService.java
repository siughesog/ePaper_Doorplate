package org.example.service;

import org.example.dto.ImageLibraryDto;
import org.example.dto.ImageReferenceDto;
import org.example.model.DoorplateLayout;
import org.example.model.ElementStyle;
import org.example.model.ImageLibraryItem;
import org.example.repository.DoorplateLayoutRepository;
import org.example.repository.ImageLibraryRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class ImageLibraryService {
    
    private final ImageLibraryRepository imageLibraryRepository;
    private final DoorplateLayoutRepository layoutRepository;
    
    public ImageLibraryService(ImageLibraryRepository imageLibraryRepository,
                              DoorplateLayoutRepository layoutRepository) {
        this.imageLibraryRepository = imageLibraryRepository;
        this.layoutRepository = layoutRepository;
    }
    
    public List<ImageLibraryDto> getImageLibraryByUserId(String userId) {
        List<ImageLibraryItem> items = imageLibraryRepository.findByUserId(userId);
        return items.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }
    
    public ImageLibraryDto saveImageLibraryItem(String userId, ImageLibraryDto dto) {
        ImageLibraryItem item;
        
        if (dto.getId() != null && !dto.getId().isEmpty()) {
            // 更新現有項目
            Optional<ImageLibraryItem> existingOpt = imageLibraryRepository.findById(dto.getId());
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
        ImageLibraryItem savedItem = imageLibraryRepository.save(item);
        return convertToDto(savedItem);
    }
    
    public boolean deleteImageLibraryItem(String userId, String itemId) {
        try {
            imageLibraryRepository.deleteByUserIdAndId(userId, itemId);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
    
    public Optional<ImageLibraryDto> getImageLibraryItemById(String itemId) {
        return imageLibraryRepository.findById(itemId)
                .map(this::convertToDto);
    }
    
    /**
     * 獲取動態圖片庫項目的引用（哪些 layout 使用了這個動態圖片庫項目）
     * @param libraryItemId 動態圖片庫項目的ID
     * @return 引用列表
     */
    public List<ImageReferenceDto> getImageLibraryItemReferences(String libraryItemId) {
        List<ImageReferenceDto> references = new ArrayList<>();
        
        System.out.println("🔍 查找動態圖片庫項目引用，libraryItemId: " + libraryItemId);
        
        // 查找所有包含該動態圖片庫項目的layout
        List<DoorplateLayout> allLayouts = layoutRepository.findAll();
        System.out.println("   總共找到 " + allLayouts.size() + " 個 layout");
        
        for (DoorplateLayout layout : allLayouts) {
            if (layout.getElements() != null) {
                for (ElementStyle element : layout.getElements()) {
                    // 檢查動態圖片元素，看是否使用了這個動態圖片庫項目
                    if ("dynamicImage".equals(element.getType())) {
                        String elementSelectedImageId = element.getSelectedImageId();
                        System.out.println("   檢查 layout: " + layout.getLayoutName() + 
                            ", element type: " + element.getType() + 
                            ", selectedImageId: " + elementSelectedImageId);
                        
                        if (libraryItemId.equals(elementSelectedImageId)) {
                            System.out.println("   ✅ 找到匹配的引用: " + layout.getLayoutName());
                            references.add(new ImageReferenceDto(
                                layout.getId(),
                                layout.getLayoutName(),
                                layout.getUserId()
                            ));
                            break; // 每個layout只需要添加一次
                        }
                    }
                }
            }
        }
        
        System.out.println("   總共找到 " + references.size() + " 個引用");
        return references;
    }
    
    private ImageLibraryItem createNewItem(String userId, ImageLibraryDto dto) {
        ImageLibraryItem item = new ImageLibraryItem();
        item.setUserId(userId);
        item.setCreatedAt(Instant.now());
        updateItemFromDto(item, dto);
        return item;
    }
    
    private void updateItemFromDto(ImageLibraryItem item, ImageLibraryDto dto) {
        item.setName(dto.getName());
        item.setOriginalImageId(dto.getOriginalImageId());
        item.setOriginalImagePath(dto.getOriginalImagePath());
        item.setBlackThreshold(dto.getBlackThreshold());
        item.setWhiteThreshold(dto.getWhiteThreshold());
        item.setContrast(dto.getContrast());
        item.setProcessedImageUrl(dto.getProcessedImageUrl());
        item.setFormat(dto.getFormat());
        item.setDescription(dto.getDescription());
        item.setTags(dto.getTags());
    }
    
    private ImageLibraryDto convertToDto(ImageLibraryItem item) {
        ImageLibraryDto dto = new ImageLibraryDto();
        dto.setId(item.getId());
        dto.setName(item.getName());
        dto.setOriginalImageId(item.getOriginalImageId());
        dto.setOriginalImagePath(item.getOriginalImagePath());
        dto.setBlackThreshold(item.getBlackThreshold());
        dto.setWhiteThreshold(item.getWhiteThreshold());
        dto.setContrast(item.getContrast());
        dto.setProcessedImageUrl(item.getProcessedImageUrl());
        dto.setFormat(item.getFormat());
        dto.setDescription(item.getDescription());
        dto.setTags(item.getTags());
        return dto;
    }
}



