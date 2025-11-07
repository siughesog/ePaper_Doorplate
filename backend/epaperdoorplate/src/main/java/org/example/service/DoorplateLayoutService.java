package org.example.service;

import org.example.dto.TemplateSummaryDto;
import org.example.model.DoorplateLayout;
import org.example.model.ElementStyle;
import org.example.repository.DoorplateLayoutRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class DoorplateLayoutService {

    private final DoorplateLayoutRepository layoutRepository;

    public DoorplateLayoutService(DoorplateLayoutRepository layoutRepository) {
        this.layoutRepository = layoutRepository;
    }

    public boolean updateElementsByUserId(String userId, List<ElementStyle> newElements) {
        return layoutRepository.findByUserId(userId).map(layout -> {
            layout.setElements(newElements);
            layout.setUpdatedAt(Instant.now());
            layoutRepository.save(layout);
            return true;
        }).orElse(false);
    }

    public boolean updateElements(String userId, String layoutName, List<ElementStyle> newElements) {
        return layoutRepository.findByUserIdAndLayoutName(userId, layoutName).map(layout -> {
            layout.setElements(newElements);
            layout.setUpdatedAt(Instant.now());
            layoutRepository.save(layout);
            return true;
        }).orElse(false);
    }


    public DoorplateLayout createNewLayout(String userId, String layoutName, List<ElementStyle> elements) {
        DoorplateLayout layout = new DoorplateLayout();
        layout.setUserId(userId);
        layout.setLayoutName(layoutName);
        layout.setElements(elements);
        layout.setUpdatedAt(Instant.now());
        return layoutRepository.save(layout);
    }

    public DoorplateLayout createOrUpdateLayout(String userId, String layoutName, List<ElementStyle> elements) {
        return layoutRepository.findByUserIdAndLayoutName(userId, layoutName)
                .map(existingLayout -> {
                    existingLayout.setElements(elements);
                    existingLayout.setUpdatedAt(Instant.now());
                    return layoutRepository.save(existingLayout);
                })
                .orElseGet(() -> {
                    DoorplateLayout newLayout = new DoorplateLayout();
                    newLayout.setUserId(userId);
                    newLayout.setLayoutName(layoutName);
                    newLayout.setElements(elements);
                    newLayout.setUpdatedAt(Instant.now());
                    return layoutRepository.save(newLayout);
                });
    }

    public List<TemplateSummaryDto> getAllLayoutSummaries() {
        return layoutRepository.findAll()
                .stream()
                .map(layout -> new TemplateSummaryDto(layout.getId(), layout.getLayoutName()))
                .collect(Collectors.toList());
    }

    public void deleteLayout(String userId, String layoutName) {
        layoutRepository.deleteByUserIdAndLayoutName(userId, layoutName);
        System.out.println("Layout 已刪除");
    }


    public Optional<DoorplateLayout> findLayoutByUserIdAndName(String userId, String layoutName) {
        return layoutRepository.findByUserIdAndLayoutName(userId, layoutName);
    }

    public Optional<DoorplateLayout> findLayoutById(String layoutId) {
        return layoutRepository.findById(layoutId);
    }

    public DoorplateLayout saveLayout(DoorplateLayout layout) {
        layout.setUpdatedAt(Instant.now());
        return layoutRepository.save(layout);
    }



    public List<TemplateSummaryDto> getLayoutSummariesByUserId(String userId) {
        List<DoorplateLayout> layouts = layoutRepository.findAllByUserId(userId);

        return layouts.stream()
                .map(layout -> new TemplateSummaryDto(
                        layout.getId(),
                        layout.getLayoutName(),
                        "/layout/load"  // 使用相對路徑，由前端自動加上 baseURL
                ))
                .toList();
    }




}
