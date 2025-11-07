package org.example.controller;

import org.example.dto.ImageReferenceDto;
import org.example.model.ImageFile;
import org.example.service.ImageService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;

@RestController
@RequestMapping("/api/images")
public class ImageController {

    private final ImageService imageService;

    public ImageController(ImageService imageService) {
        this.imageService = imageService;
    }

    @GetMapping
    public List<ImageFile> listImages(@RequestParam String userId, Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限訪問其他用戶的圖片");
        }
        return imageService.getImagesByUserId(userId);
    }

    @PostMapping
    public ResponseEntity<?> uploadImage(@RequestParam("file") MultipartFile file, 
                                                @RequestParam String userId,
                                                Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("無權限為其他用戶上傳圖片");
        }
        try {
            ImageFile image = imageService.saveImage(file, userId);
            return ResponseEntity.ok(image);
        } catch (IllegalArgumentException e) {
            // 檔案驗證錯誤
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("檔案保存失敗: " + e.getMessage());
        }
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteImage(@PathVariable String id, 
                                           @RequestParam String userId,
                                           Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限刪除其他用戶的圖片");
        }
        imageService.deleteImage(id, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/references")
    public ResponseEntity<List<ImageReferenceDto>> getImageReferences(@PathVariable String id) {
        List<ImageReferenceDto> references = imageService.getImageReferences(id);
        return ResponseEntity.ok(references);
    }

}