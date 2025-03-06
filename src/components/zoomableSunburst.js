import * as d3 from "d3";

export function ZoomableSunburst(data, {
  width = 640,
  height = width,
  margin = 1,
  padding = 1,
  radius = Math.min(width, height) / 2 - margin,
  label = d => d.data.name,
  title = (d, n) => n.ancestors().map(d => d.data.name).reverse().join("/"),
  value = d => d.value,
  color = d3.interpolateRainbow,
  labelVisible = d => d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03
} = {}) {
  const root = d3.hierarchy(data)
      .sum(value)
      .sort((a, b) => b.value - a.value);
  
  const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 2 * Math.PI / 100))
      .padRadius(radius * 1.5)
      .innerRadius(d => Math.max(0, radius * Math.sqrt(d.y0)))
      .outerRadius(d => Math.max(0, radius * Math.sqrt(d.y1) - padding));

  const partition = d3.partition()
      .size([2 * Math.PI, radius * radius]);

  partition(root);

  const svg = d3.create("svg")
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  // Store the current view state
  root.each(d => d.current = {
    x0: d.x0,
    x1: d.x1,
    y0: d.y0,
    y1: d.y1
  });

  const cell = svg
    .append("g")
    .selectAll("path")
    .data(root.descendants().filter(d => d.depth))
    .join("path")
      .attr("fill", d => { 
        while (d.depth > 1) d = d.parent; 
        return d3.interpolateRainbow(d.value / root.value * 0.8 + (d.children ? 0 : 0.2)); 
      })
      .attr("d", d => arc(d.current))
      .attr("pointer-events", "all");

  cell.append("title")
      .text(title);

  const text = svg
    .append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
    .selectAll("text")
    .data(root.descendants().filter(d => d.depth && labelVisible(d)))
    .join("text")
      .attr("transform", d => {
        const x = (d.current.x0 + d.current.x1) / 2 * 180 / Math.PI;
        const y = Math.sqrt(d.current.y0 + d.current.y1) / 2 * radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .attr("dy", "0.35em")
      .text(label);

  let parent = svg
    .append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", (event, p) => {
        // If we're already at the root, don't do anything
        if (p === root) return;
        
        // Otherwise, zoom out to the parent
        clicked(event, p.parent || root);
      });

  // Handle zoom on click
  function clicked(event, p) {
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = cell.transition().duration(750);

    cell.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
        .attr("d", d => arc(d.current));

    text.transition(t)
        .attr("transform", d => {
          const x = (d.current.x0 + d.current.x1) / 2 * 180 / Math.PI;
          const y = Math.sqrt(d.current.y0 + d.current.y1) / 2 * radius;
          return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
        })
        .attr("opacity", d => labelVisible(d.target) ? 1 : 0);
  }

  // Add click handler to cells
  cell.on("click", clicked);

  return Object.assign(svg.node(), {value: null});
}

// Helper function to transform hierarchical data for the sunburst
export function transformDataForSunburst(categories, subcategories, solutions) {
  // Create the root node
  const root = {
    name: "All Categories",
    children: [],
    value: 0
  };
  
  // Create a map for categories with proper initialization
  const categoryMap = new Map();
  
  // Process categories
  if (categories && Array.isArray(categories)) {
    categories.forEach(category => {
      if (!category) return;
      
      // Get the category ID and name
      const categoryId = category.id;
      const categoryName = category["Category Name"];
      
      if (!categoryId || !categoryName) return;
      
      // Create category node with children array
      const categoryNode = {
        name: categoryName,
        id: categoryId,
        children: [],
        value: 0
      };
      
      // Add to map and root
      categoryMap.set(categoryId, categoryNode);
      root.children.push(categoryNode);
    });
  }
  
  // Create a map for subcategories
  const subcategoryMap = new Map();
  
  // Process subcategories
  if (subcategories && Array.isArray(subcategories)) {
    subcategories.forEach(subcategory => {
      if (!subcategory) return;
      
      // Get the subcategory ID and name
      const subcategoryId = subcategory.id;
      const subcategoryName = subcategory["Subcategory Name"];
      
      if (!subcategoryId || !subcategoryName) return;
      
      // Get parent category information
      let parentCategoryId = null;
      
      // Try to get parent category from Parent Category field
      if (subcategory["Parent Category"]) {
        try {
          // The Parent Category field is an array in string format
          const parentCategoryStr = subcategory["Parent Category"];
          // Replace single quotes with double quotes for proper JSON parsing
          const parentCategories = JSON.parse(parentCategoryStr.replace(/'/g, '"'));
          
          // Find the category ID by name
          for (const [id, cat] of categoryMap.entries()) {
            if (parentCategories.includes(cat.name)) {
              parentCategoryId = id;
              break;
            }
          }
        } catch (e) {
          console.error("Error parsing Parent Category:", e);
        }
      }
      
      // Create subcategory node with children array
      const subcategoryNode = {
        name: subcategoryName,
        id: subcategoryId,
        children: [],
        value: 0
      };
      
      // Add to subcategory map
      subcategoryMap.set(subcategoryId, subcategoryNode);
      
      // Add to parent category if found
      if (parentCategoryId && categoryMap.has(parentCategoryId)) {
        categoryMap.get(parentCategoryId).children.push(subcategoryNode);
      } else {
        // If no parent category found, add directly to root
        root.children.push(subcategoryNode);
      }
    });
  }
  
  // Process solutions
  if (solutions && Array.isArray(solutions)) {
    solutions.forEach(solution => {
      if (!solution) return;
      
      // Get solution name
      const solutionName = solution.solution_name;
      
      if (!solutionName) return;
      
      // Create solution node with a default value of 1
      const solutionNode = {
        name: solutionName,
        value: 1
      };
      
      // Try to find parent subcategory
      let parentFound = false;
      
      // Check if solution has subcategory information
      if (solution.subcategory) {
        // Try to find subcategory by name
        for (const [id, subcat] of subcategoryMap.entries()) {
          if (subcat.name === solution.subcategory) {
            subcat.children.push(solutionNode);
            parentFound = true;
            break;
          }
        }
      }
      
      // If no subcategory found, try to add to category
      if (!parentFound && solution.category) {
        // Try to find category by name
        for (const [id, cat] of categoryMap.entries()) {
          if (cat.name === solution.category) {
            cat.children.push(solutionNode);
            parentFound = true;
            break;
          }
        }
      }
      
      // If still no parent found, add to root
      if (!parentFound) {
        // Create an "Uncategorized" category if it doesn't exist
        let uncategorized = root.children.find(c => c.name === "Uncategorized");
        if (!uncategorized) {
          uncategorized = {
            name: "Uncategorized",
            children: [],
            value: 0
          };
          root.children.push(uncategorized);
        }
        uncategorized.children.push(solutionNode);
      }
    });
  }
  
  // Remove empty categories and subcategories
  const filterEmptyNodes = (node) => {
    if (!node.children) return true;
    node.children = node.children.filter(filterEmptyNodes);
    return node.children.length > 0 || node.name === "All Categories";
  };
  
  filterEmptyNodes(root);
  
  return root;
} 