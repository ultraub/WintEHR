/**
 * Force-directed Network Visualization Utilities
 * Provides D3.js-based force simulation for network diagrams
 */

import * as d3 from 'd3';

/**
 * Initialize force simulation for network diagram
 */
export const initializeForceSimulation = (nodes, links, dimensions) => {
  const { width, height } = dimensions;
  
  const simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => {
        // Variable link distance based on relationship type
        switch (d.type) {
          case 'subject':
          case 'patient':
            return 50;
          case 'performer':
          case 'requester':
            return 70;
          default:
            return 100;
        }
      })
      .strength(d => {
        // Stronger connections for direct relationships
        return d.type === 'subject' || d.type === 'patient' ? 1 : 0.5;
      })
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        // Variable charge based on node type
        switch (d.type) {
          case 'patient':
            return -500;
          case 'provider':
            return -300;
          case 'organization':
            return -400;
          default:
            return -200;
        }
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => d.radius + 5)
    )
    .force('x', d3.forceX(width / 2).strength(0.05))
    .force('y', d3.forceY(height / 2).strength(0.05));
  
  return simulation;
};

/**
 * Apply clustering force to group related nodes
 */
export const applyClusteringForce = (simulation, clusterCenters) => {
  simulation.force('cluster', (alpha) => {
    simulation.nodes().forEach(node => {
      const cluster = clusterCenters[node.cluster];
      if (cluster) {
        const k = alpha * 0.1;
        node.vx -= (node.x - cluster.x) * k;
        node.vy -= (node.y - cluster.y) * k;
      }
    });
  });
};

/**
 * Create zoom behavior for network
 */
export const createZoomBehavior = (svg, container, onZoom) => {
  const zoom = d3.zoom()
    .scaleExtent([0.1, 10])
    .on('zoom', (event) => {
      container.attr('transform', event.transform);
      if (onZoom) onZoom(event.transform.k);
    });
  
  svg.call(zoom);
  
  return {
    zoomIn: () => svg.transition().duration(300).call(zoom.scaleBy, 1.5),
    zoomOut: () => svg.transition().duration(300).call(zoom.scaleBy, 0.75),
    resetZoom: () => svg.transition().duration(300).call(
      zoom.transform,
      d3.zoomIdentity
    ),
    zoomToNode: (node, scale = 2) => {
      svg.transition().duration(500).call(
        zoom.transform,
        d3.zoomIdentity
          .translate(svg.node().clientWidth / 2, svg.node().clientHeight / 2)
          .scale(scale)
          .translate(-node.x, -node.y)
      );
    }
  };
};

/**
 * Calculate node clusters for better organization
 */
export const calculateClusters = (nodes, links) => {
  const clusters = {};
  const clusterCenters = {};
  
  // Group nodes by type
  nodes.forEach(node => {
    if (!clusters[node.type]) {
      clusters[node.type] = [];
    }
    clusters[node.type].push(node);
    node.cluster = node.type;
  });
  
  // Calculate cluster centers
  const clusterCount = Object.keys(clusters).length;
  let index = 0;
  
  Object.entries(clusters).forEach(([type, clusterNodes]) => {
    const angle = (2 * Math.PI * index) / clusterCount;
    const radius = 200;
    
    clusterCenters[type] = {
      x: 400 + radius * Math.cos(angle),
      y: 300 + radius * Math.sin(angle)
    };
    
    index++;
  });
  
  return { clusters, clusterCenters };
};

/**
 * Apply radial layout for hierarchical data
 */
export const applyRadialLayout = (nodes, links, centerNode) => {
  const levels = {};
  const visited = new Set();
  
  // BFS to assign levels
  const queue = [{ node: centerNode, level: 0 }];
  visited.add(centerNode.id);
  
  while (queue.length > 0) {
    const { node, level } = queue.shift();
    
    if (!levels[level]) levels[level] = [];
    levels[level].push(node);
    
    // Find connected nodes
    links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      
      if (sourceId === node.id && !visited.has(targetId)) {
        const targetNode = nodes.find(n => n.id === targetId);
        if (targetNode) {
          queue.push({ node: targetNode, level: level + 1 });
          visited.add(targetId);
        }
      }
      if (targetId === node.id && !visited.has(sourceId)) {
        const sourceNode = nodes.find(n => n.id === sourceId);
        if (sourceNode) {
          queue.push({ node: sourceNode, level: level + 1 });
          visited.add(sourceId);
        }
      }
    });
  }
  
  // Position nodes in radial layout
  Object.entries(levels).forEach(([level, levelNodes]) => {
    const levelNum = parseInt(level);
    const radius = levelNum * 100 + 50;
    const angleStep = (2 * Math.PI) / levelNodes.length;
    
    levelNodes.forEach((node, i) => {
      const angle = i * angleStep;
      node.x = 400 + radius * Math.cos(angle);
      node.y = 300 + radius * Math.sin(angle);
      node.fx = node.x;
      node.fy = node.y;
    });
  });
};

/**
 * Calculate network metrics
 */
export const calculateNetworkMetrics = (nodes, links) => {
  // Degree centrality
  const degreeMap = new Map();
  
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    
    degreeMap.set(sourceId, (degreeMap.get(sourceId) || 0) + 1);
    degreeMap.set(targetId, (degreeMap.get(targetId) || 0) + 1);
  });
  
  // Calculate betweenness centrality (simplified)
  const betweenness = new Map();
  nodes.forEach(node => betweenness.set(node.id, 0));
  
  // Network density
  const possibleConnections = nodes.length * (nodes.length - 1) / 2;
  const density = links.length / possibleConnections;
  
  return {
    degree: degreeMap,
    betweenness,
    density,
    avgDegree: Array.from(degreeMap.values()).reduce((a, b) => a + b, 0) / nodes.length,
    components: findConnectedComponents(nodes, links)
  };
};

/**
 * Find connected components in the network
 */
const findConnectedComponents = (nodes, links) => {
  const adjacencyList = new Map();
  const visited = new Set();
  const components = [];
  
  // Build adjacency list
  nodes.forEach(node => adjacencyList.set(node.id, []));
  links.forEach(link => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;
    
    adjacencyList.get(sourceId).push(targetId);
    adjacencyList.get(targetId).push(sourceId);
  });
  
  // DFS to find components
  const dfs = (nodeId, component) => {
    visited.add(nodeId);
    component.push(nodeId);
    
    adjacencyList.get(nodeId).forEach(neighbor => {
      if (!visited.has(neighbor)) {
        dfs(neighbor, component);
      }
    });
  };
  
  nodes.forEach(node => {
    if (!visited.has(node.id)) {
      const component = [];
      dfs(node.id, component);
      components.push(component);
    }
  });
  
  return components;
};

/**
 * Export network as image
 */
export const exportNetworkAsImage = async (svgElement, format = 'png') => {
  const svgData = new XMLSerializer().serializeToString(svgElement);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const img = new Image();
  
  canvas.width = svgElement.clientWidth;
  canvas.height = svgElement.clientHeight;
  
  return new Promise((resolve, reject) => {
    img.onload = () => {
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `network-diagram-${new Date().toISOString().split('T')[0]}.${format}`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      });
    };
    
    img.onerror = reject;
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  });
};