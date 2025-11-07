package org.example.controller;

import org.example.dto.ImageLibraryDto;
import org.example.dto.ImageReferenceDto;
import org.example.service.ImageLibraryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/imageLibrary")
public class ImageLibraryController {
    
    @Autowired
    private ImageLibraryService imageLibraryService;
    
    @GetMapping("/list")
    public List<ImageLibraryDto> getImageLibrary(@RequestParam String userId, Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限訪問其他用戶的圖片庫");
        }
        return imageLibraryService.getImageLibraryByUserId(userId);
    }
    
    @PostMapping("/save")
    public ImageLibraryDto saveImageLibraryItem(
            @RequestParam String userId,
            @RequestBody ImageLibraryDto dto,
            Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限為其他用戶保存圖片庫項目");
        }
        return imageLibraryService.saveImageLibraryItem(userId, dto);
    }
    
    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteImageLibraryItem(
            @RequestParam String userId,
            @RequestParam String itemId,
            Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限刪除其他用戶的圖片庫項目");
        }
        boolean success = imageLibraryService.deleteImageLibraryItem(userId, itemId);
        if (success) {
            return ResponseEntity.ok("圖片庫項目刪除成功");
        } else {
            return ResponseEntity.badRequest().body("刪除失敗");
        }
    }
    
    @GetMapping("/get")
    public ResponseEntity<ImageLibraryDto> getImageLibraryItem(@RequestParam String itemId) {
        return imageLibraryService.getImageLibraryItemById(itemId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
    
    @GetMapping("/{itemId}/references")
    public ResponseEntity<List<ImageReferenceDto>> getImageLibraryItemReferences(@PathVariable String itemId) {
        List<ImageReferenceDto> references = imageLibraryService.getImageLibraryItemReferences(itemId);
        return ResponseEntity.ok(references);
    }
}
