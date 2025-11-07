package org.example.controller;

import org.example.dto.TextLibraryDto;
import org.example.service.TextLibraryService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/textLibrary")
public class TextLibraryController {
    
    @Autowired
    private TextLibraryService textLibraryService;
    
    @GetMapping("/list")
    public List<TextLibraryDto> getTextLibrary(
            @RequestParam String userId,
            @RequestParam(required = false) String elementId) {
        if (elementId != null && !elementId.isEmpty()) {
            return textLibraryService.getTextLibraryByUserIdAndElementId(userId, elementId);
        } else {
            return textLibraryService.getTextLibraryByUserId(userId);
        }
    }
    
    @PostMapping("/save")
    public TextLibraryDto saveTextLibraryItem(
            @RequestParam String userId,
            @RequestBody TextLibraryDto dto) {
        return textLibraryService.saveTextLibraryItem(userId, dto);
    }
    
    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteTextLibraryItem(
            @RequestParam String userId,
            @RequestParam String textId) {
        boolean success = textLibraryService.deleteTextLibraryItem(userId, textId);
        if (success) {
            return ResponseEntity.ok("文字庫項目刪除成功");
        } else {
            return ResponseEntity.badRequest().body("刪除失敗");
        }
    }
    
    @GetMapping("/get")
    public ResponseEntity<TextLibraryDto> getTextLibraryItem(@RequestParam String textId) {
        return textLibraryService.getTextLibraryItemById(textId)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
