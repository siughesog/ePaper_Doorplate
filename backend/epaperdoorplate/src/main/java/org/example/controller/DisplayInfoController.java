package org.example.controller;



import org.example.model.DisplayInfo;
import org.example.service.DisplayInfoService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/display-info")
public class DisplayInfoController {

    @Autowired
    private DisplayInfoService service;

    @GetMapping
    public List<DisplayInfo> getAll() {
        return service.getAll();
    }

    @GetMapping("/{id}")
    public Optional<DisplayInfo> getById(@PathVariable String id) {
        return service.getById(id);
    }

    @PostMapping
    public DisplayInfo createOrUpdate(@RequestBody DisplayInfo displayInfo) {
        return service.createOrUpdate(displayInfo);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable String id) {
        service.deleteById(id);
    }

    @GetMapping("/search")
    public Optional<DisplayInfo> getByFullName(@RequestParam String fullName) {
        return service.getByFullName(fullName);
    }
}
