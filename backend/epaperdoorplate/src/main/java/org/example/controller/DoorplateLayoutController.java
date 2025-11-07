package org.example.controller;

import org.example.dto.DetailDTO;
import org.example.dto.TemplateSummaryDto;
import org.example.model.DoorplateLayout;
import org.example.model.ElementStyle;
import org.example.service.DoorplateLayoutService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/layout")
public class DoorplateLayoutController {

    @Autowired
    private DoorplateLayoutService doorplateLayoutService;



    @PostMapping("/createOrUpdate")
    public DoorplateLayout createLayout(
            @RequestParam String userId,
            @RequestParam String layoutName,
            @RequestBody List<ElementStyle> elements,
            Authentication authentication
    ) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限為其他用戶創建佈局");
        }
        return doorplateLayoutService.createOrUpdateLayout(userId, layoutName, elements);
    }

    @PostMapping("/updateById")
    public ResponseEntity<DoorplateLayout> updateLayoutById(
            @RequestParam String layoutId,
            @RequestBody List<ElementStyle> elements
    ) {
        System.out.println("📥 收到更新 layout 請求，layoutId: " + layoutId);
        System.out.println("   元素總數: " + elements.size());
        
        // 調試：檢查是否有 dynamicImage 元素包含 selectedImageId
        for (ElementStyle element : elements) {
            if ("dynamicImage".equals(element.getType())) {
                System.out.println("📝 保存 layout，發現 dynamicImage 元素:");
                System.out.println("   - element id: " + element.getId());
                System.out.println("   - selectedImageId: " + element.getSelectedImageId());
                System.out.println("   - imageId: " + element.getImageId());
                System.out.println("   - content: " + element.getContent());
                System.out.println("   - type: " + element.getType());
                System.out.println("   - blackThreshold: " + element.getBlackThreshold());
                System.out.println("   - whiteThreshold: " + element.getWhiteThreshold());
                System.out.println("   - contrast: " + element.getContrast());
                
                // 使用反射檢查所有字段
                System.out.println("   - 所有字段檢查（使用反射）:");
                java.lang.reflect.Field[] fields = element.getClass().getDeclaredFields();
                for (java.lang.reflect.Field field : fields) {
                    field.setAccessible(true);
                    try {
                        Object value = field.get(element);
                        System.out.println("     * " + field.getName() + ": " + value);
                    } catch (IllegalAccessException e) {
                        System.out.println("     * " + field.getName() + ": (無法訪問)");
                    }
                }
            }
        }
        
        Optional<DoorplateLayout> layoutOpt = doorplateLayoutService.findLayoutById(layoutId);
        if (layoutOpt.isPresent()) {
            DoorplateLayout layout = layoutOpt.get();
            layout.setElements(elements);
            DoorplateLayout updatedLayout = doorplateLayoutService.saveLayout(layout);
            
            // 調試：檢查保存後的數據
            if (updatedLayout.getElements() != null) {
                for (ElementStyle element : updatedLayout.getElements()) {
                    if ("dynamicImage".equals(element.getType())) {
                        System.out.println("💾 保存後檢查 dynamicImage 元素:");
                        System.out.println("   - element id: " + element.getId());
                        System.out.println("   - selectedImageId: " + element.getSelectedImageId());
                    }
                }
            }
            
            return ResponseEntity.ok(updatedLayout);
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/load")
    public ResponseEntity<DoorplateLayout> loadLayout(
            @RequestParam String userId,
            @RequestParam String layoutName,
            Authentication authentication
    ) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限訪問其他用戶的佈局");
        }
        
        Optional<DoorplateLayout> layoutOpt = doorplateLayoutService.findLayoutByUserIdAndName(userId, layoutName);
        if (layoutOpt.isPresent()) {
            return ResponseEntity.ok(layoutOpt.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }

    @GetMapping("/loadById")
    public ResponseEntity<DoorplateLayout> loadLayoutById(
            @RequestParam String layoutId
    ) {
        Optional<DoorplateLayout> layoutOpt = doorplateLayoutService.findLayoutById(layoutId);
        if (layoutOpt.isPresent()) {
            return ResponseEntity.ok(layoutOpt.get());
        } else {
            return ResponseEntity.notFound().build();
        }
    }




    //@GetMapping("layout/load")
    //public List<TemplateSummaryDto> getLayoutSummaries() {
        //return doorplateLayoutService.getAllLayoutSummaries();
    //}


    @DeleteMapping("/delete")
    public ResponseEntity<String> deleteLayout(
            @RequestParam String userId,
            @RequestParam String layoutName,
            Authentication authentication) {
        
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限刪除其他用戶的佈局");
        }

        doorplateLayoutService.deleteLayout(userId, layoutName);
        return ResponseEntity.ok("Layout 刪除成功");
    }

    @GetMapping("/summary")
    public List<TemplateSummaryDto> loadLayouts(@RequestParam String userId, 
                                               Authentication authentication) {
        // 驗證當前登錄用戶是否與請求的userId匹配
        String currentUsername = authentication.getName();
        if (!currentUsername.equals(userId)) {
            throw new SecurityException("無權限訪問其他用戶的數據");
        }
        return doorplateLayoutService.getLayoutSummariesByUserId(userId);
    }

    @PostMapping("/api/details")
    public ResponseEntity<?> receiveDetail(@RequestBody DetailDTO detail) {
        // 這裡可以執行儲存、驗證或其他邏輯
        System.out.println("✅ Received detail: " + detail);

        // 假設成功儲存，回傳成功的 JSON 結果
        return ResponseEntity.ok().body(detail);
    }

}
