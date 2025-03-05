import * as d3 from "d3";

export function ZoomableIcicle(data, {
  width = 975,
  height = 600,
  margin = {top: 30, right: 10, bottom: 0, left: 10},
  padding = 1,
  color = d3.interpolateRainbow,
  label = d => d.data.name,
  title = (d, n) => n.ancestors().map(d => d.data.name).reverse().join("/"),
  value = d => d.value
} = {}) {
  const x = d3.scaleLinear().rangeRound([0, width]);
  const y = d3.scaleLinear().rangeRound([0, height - margin.top - margin.bottom]);

  const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; font: 10px sans-serif;");

  const root = d3.hierarchy(data)
      .sum(value)
      .sort((a, b) => b.height - a.height || b.value - a.value);

  const partition = d3.partition()
      .size([width, height - margin.top - margin.bottom])
      .padding(padding);

  partition(root);

  // Set initial domain for scales
  x.domain([root.x0, root.x1]);
  y.domain([root.y0, 1]);

  const cell = svg.append("g")
      .attr("transform", `translate(0,${margin.top})`)
    .selectAll("rect")
    .data(root.descendants())
    .join("rect")
      .attr("x", d => x(d.x0))
      .attr("y", d => y(d.y0))
      .attr("width", d => x(d.x1) - x(d.x0))
      .attr("height", d => y(d.y1) - y(d.y0))
      .attr("fill", d => {
        if (!d.depth) return "#ccc";
        while (d.depth > 1) d = d.parent;
        return color(d.value / root.value * 0.8 + (d.children ? 0 : 0.2));
      })
      .attr("cursor", "pointer");

  cell.append("title")
      .text(title);

  const text = svg.append("g")
      .attr("transform", `translate(0,${margin.top})`)
      .attr("pointer-events", "none")
      .attr("fill", "white")
    .selectAll("text")
    .data(root.descendants().filter(d => (x(d.x1) - x(d.x0)) > 10))
    .join("text")
      .attr("x", d => x(d.x0) + 5)
      .attr("y", d => y(d.y0) + 15)
      .text(label);

  // Create a breadcrumb at the top
  const breadcrumb = svg.append("text")
      .attr("y", 15)
      .attr("x", 10)
      .attr("font-weight", "bold")
      .text(root.data.name);

  // Handle zoom on click
  function clicked(event, p) {
    // Update breadcrumb
    breadcrumb.text(p.ancestors().map(d => d.data.name).reverse().join(" > "));

    // Zoom to the clicked rectangle
    svg.transition()
        .duration(750)
        .tween("zoom", () => {
          const xd = d3.interpolate(x.domain(), [p.x0, p.x1]);
          const yd = d3.interpolate(y.domain(), [p.y0, 1]);
          return t => {
            x.domain(xd(t));
            y.domain(yd(t));
            
            cell.attr("x", d => x(d.x0))
                .attr("y", d => y(d.y0))
                .attr("width", d => x(d.x1) - x(d.x0))
                .attr("height", d => y(d.y1) - y(d.y0));
                
            text.attr("x", d => x(d.x0) + 5)
                .attr("y", d => y(d.y0) + 15)
                .attr("opacity", d => {
                  const width = x(d.x1) - x(d.x0);
                  const height = y(d.y1) - y(d.y0);
                  return width > 20 && height > 15 ? 1 : 0;
                });
          };
        });
  }

  cell.on("click", clicked);

  // Add a reset button
  const resetButton = svg.append("text")
      .attr("x", width - 60)
      .attr("y", 15)
      .attr("cursor", "pointer")
      .attr("font-weight", "bold")
      .text("Reset")
      .on("click", (event) => {
        event.stopPropagation();
        clicked(null, root);
      });

  return Object.assign(svg.node(), {value: null});
}

// Helper function to transform hierarchical data for the icicle
export function transformDataForIcicle(categories, subcategories, solutions) {
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