package org.example.controller;


import org.example.dto.TemplateSummaryDto;
import org.example.model.ElementStyle;
import org.example.model.LayoutConfig;
    import org.example.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.List;


import java.util.ArrayList;

@RestController
public class UserController {

    //private UserRepository userRepository;


    //private UserContentRepository userContentRepository;


    @GetMapping("/elements")
    public List<ElementStyle> getElements() {
        List<ElementStyle> elements = new ArrayList<>();

        ElementStyle e1 = new ElementStyle();
        e1.setId("elem-1");
        e1.setType("fullName");
        e1.setX(50);
        e1.setY(50);
        e1.setWidth(200);
        e1.setHeight(40);

        ElementStyle e2 = new ElementStyle();
        e2.setId("elem-2");
        e2.setType("department");
        e2.setX(0);
        e2.setY(0);
        e2.setWidth(600);
        e2.setHeight(300);

        elements.add(e1);
        elements.add(e2);

        return elements;
    }



}
