import * as d3 from "d3";

export function CollapsibleTree(data, {
  width = 954,
  height = 800,
  margin = {top: 60, right: 120, bottom: 40, left: 0},
  label = d => d.data.name,
  title = (d, n) => n.ancestors().map(d => d.data.name).reverse().join("/"),
  linkColor = "#999",
  nodeRadius = 4.5,
  nodeStroke = "#555",
  nodeFill = "white",
  nodeStrokeWidth = 1.0,
  fontSize = 12
} = {}) {
  // Create the hierarchy from the data
  const root = d3.hierarchy(data);
  
  // Store children in _children property for collapse/expand functionality
  root.descendants().forEach(d => {
    d._children = d.children;
    if (d.depth > 0) d.children = null; // Collapse all except root
    
    // Initialize positions for animations
    d.x0 = 0;
    d.y0 = 0;
  });
  
  // Expand only the root node to show first level
  if (root._children) {
    root.children = root._children;
  }
  
  // Create the SVG container with a wrapper div for resizing
  const container = d3.create("div")
    .style("width", "100%")
    .style("height", "auto")
    .style("transition", "height 0.3s ease-in-out")
    .style("padding", "10px 0"); // Add some padding to the container
  
  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .attr("style", "max-width: 100%; height: auto; font: 14px sans-serif; color: white;");
  
  // Add a group for the content that we'll transform to center
  const g = svg.append("g");
  
  // Create groups for links and nodes
  const gLink = g.append("g")
    .attr("fill", "none")
    .attr("stroke", linkColor)
    .attr("stroke-opacity", 0.4)
    .attr("stroke-width", 1.5);
  
  const gNode = g.append("g")
    .attr("cursor", "pointer")
    .attr("pointer-events", "all");
  
  // Set up the tree layout with more spacing
  const treeLayout = d3.tree()
    .nodeSize([40, 250]) // Decreased vertical spacing, reduced horizontal spacing
    .separation((a, b) => (a.parent === b.parent ? 1.3 : 2.0)); // Increased vertical separation
  
  // Function to update the tree visualization
  function update(source) {
    const duration = 400; // Animation duration in milliseconds
    
    // Apply the tree layout to the hierarchy
    const treeData = treeLayout(root);
    
    // Compute the new tree layout
    const nodes = root.descendants();
    const links = root.links();
    
    // Normalize for fixed-depth with increased spacing
    nodes.forEach(d => {
      d.y = d.depth * 275; // Reduced horizontal spacing between levels
      if (d.depth === 0) {
        d.y += 60; // Keep the root node position
      }
    });
    
    // Calculate the bounds of the tree
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(d => {
      minX = Math.min(minX, d.x);
      maxX = Math.max(maxX, d.x);
      minY = Math.min(minY, d.y);
      maxY = Math.max(maxY, d.y);
    });
    
    // Calculate required height and width with better padding
    const treeHeight = maxX - minX + margin.top + margin.bottom + 40;
    const treeWidth = maxY - minY + margin.left + margin.right;
    
    // Position the tree with proper vertical centering and left alignment
    g.attr("transform", `translate(${margin.left - 20}, ${margin.top - minX + 20})`);
    
    // Update the SVG dimensions
    svg.transition()
      .duration(duration)
      .attr("height", treeHeight)
      .attr("viewBox", [0, 0, Math.max(width, treeWidth), treeHeight]);
    
    // Update container height
    container.style("height", `${treeHeight}px`);
    
    // Update the nodes
    const node = gNode.selectAll("g")
      .data(nodes, d => d.id || (d.id = Math.random().toString(36).substr(2, 9)));
    
    // Enter any new nodes at the parent's previous position
    const nodeEnter = node.enter().append("g")
      .attr("transform", d => `translate(${source.y0},${source.x0})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .on("click", (event, d) => {
        // Toggle children on click
        if (d.children) {
          d._children = d.children;
          d.children = null;
        } else if (d._children) {
          d.children = d._children;
          d._children = null;
        }
        update(d);
      });
    
    // Add circles to the nodes
    nodeEnter.append("circle")
      .attr("r", 0) // Start with radius 0 for animation
      .attr("fill", d => d._children ? "#555" : (d.children ? nodeFill : "#999"))
      .attr("stroke", nodeStroke)
      .attr("stroke-width", nodeStrokeWidth);
    
    // Add labels to the nodes with improved positioning
    nodeEnter.append("text")
      .attr("dy", "0.31em")
      .attr("x", d => d.children || d._children ? -14 : 14) // Slightly increased text offset
      .attr("text-anchor", d => d.children || d._children ? "end" : "start")
      .each(function(d) {
        // Get the node name
        const name = d.data.name;
        // Split the text into words
        const words = name.split(/\s+/);
        
        // If more than 5 words, create a multi-line text
        if (words.length > 5) {
          const firstLine = words.slice(0, 5).join(" ");
          const secondLine = words.slice(5).join(" ");
          
          // First line
          d3.select(this)
            .text(firstLine)
            .attr("fill", "white");
          
          // Second line (add a new text element)
          d3.select(this.parentNode)
            .append("text")
            .attr("dy", "1.6em") // Slightly increased spacing between lines
            .attr("x", d => d.children || d._children ? -16 : 16) // Match the first line offset
            .attr("text-anchor", d => d.children || d._children ? "end" : "start")
            .text(secondLine)
            .attr("fill", "white")
            .attr("fill-opacity", 0)
            .attr("class", "second-line");
        } else {
          // Single line for short text
          d3.select(this)
            .text(name)
            .attr("fill", "white");
        }
      })
      .attr("fill-opacity", 0); // Start with opacity 0 for animation
    
    // Transition nodes to their new position
    const nodeUpdate = nodeEnter.merge(node)
      .transition()
      .duration(duration)
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .attr("fill-opacity", 1)
      .attr("stroke-opacity", 1);
    
    nodeUpdate.select("circle")
      .attr("r", nodeRadius)
      .attr("fill", d => d._children ? "#555" : (d.children ? nodeFill : "#999"));
    
    nodeUpdate.select("text")
      .attr("fill-opacity", 1)
      .attr("fill", "white");
    
    // Also update the second line if it exists
    nodeUpdate.select(".second-line")
      .attr("fill-opacity", 1)
      .attr("fill", "white");
    
    // Transition exiting nodes to the parent's new position
    const nodeExit = node.exit()
      .transition()
      .duration(duration)
      .attr("transform", d => `translate(${source.y},${source.x})`)
      .attr("fill-opacity", 0)
      .attr("stroke-opacity", 0)
      .remove();
    
    nodeExit.select("circle")
      .attr("r", 0);
    
    nodeExit.select("text")
      .attr("fill-opacity", 0);
    
    // Also handle the second line in exit transition
    nodeExit.select(".second-line")
      .attr("fill-opacity", 0);
    
    // Update the links
    const link = gLink.selectAll("path")
      .data(links, d => d.target.id);
    
    // Enter any new links at the parent's previous position
    const linkEnter = link.enter().append("path")
      .attr("d", d => {
        const o = {x: source.x0, y: source.y0};
        return diagonal({source: o, target: o});
      })
      .attr("stroke-opacity", 0);
    
    // Transition links to their new position
    linkEnter.merge(link)
      .transition()
      .duration(duration)
      .attr("d", diagonal)
      .attr("stroke-opacity", 0.4);
    
    // Transition exiting nodes to the parent's new position
    link.exit()
      .transition()
      .duration(duration)
      .attr("d", d => {
        const o = {x: source.x, y: source.y};
        return diagonal({source: o, target: o});
      })
      .attr("stroke-opacity", 0)
      .remove();
    
    // Store the old positions for transition
    nodes.forEach(d => {
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
  
  // Helper function to create curved links
  function diagonal({source, target}) {
    return `
      M${source.y},${source.x}
      C${(source.y + target.y) / 2},${source.x}
       ${(source.y + target.y) / 2},${target.x}
       ${target.y},${target.x}
    `;
  }
  
  // Initial update
  update(root);
  
  return container.node();
}

// Helper function to transform hierarchical data for the tree
export function transformDataForTree(categories, subcategories, solutions) {
  // Create the root node
  const root = {
    name: "All Categories",
    children: []
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
        children: []
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
        children: []
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
      
      // Create solution node
      const solutionNode = {
        name: solutionName
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
            children: []
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