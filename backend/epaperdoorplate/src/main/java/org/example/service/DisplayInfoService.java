package org.example.service;



import org.example.model.DisplayInfo;
import org.example.repository.DisplayInfoRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class DisplayInfoService {

    @Autowired
    private DisplayInfoRepository repository;

    public List<DisplayInfo> getAll() {
        return repository.findAll();
    }

    public Optional<DisplayInfo> getById(String id) {
        return repository.findById(id);
    }

    public DisplayInfo createOrUpdate(DisplayInfo displayInfo) {
        return repository.save(displayInfo); // 自動判斷新增或更新
    }

    public void deleteById(String id) {
        repository.deleteById(id);
    }

    public Optional<DisplayInfo> getByFullName(String fullName) {
        return repository.findByFullName(fullName);
    }
}
