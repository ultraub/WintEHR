import React, { useEffect, useRef } from 'react';
import { Timeline, DataSet } from 'vis-timeline/standalone';

const VisTimelineWrapper = ({ 
  items, 
  groups, 
  options, 
  onItemClick,
  onItemSelect,
  defaultTimeStart,
  defaultTimeEnd
}) => {
  const containerRef = useRef(null);
  const timelineRef = useRef(null);
  const itemsDataSetRef = useRef(null);
  const groupsDataSetRef = useRef(null);

  // Initialize timeline only once
  useEffect(() => {
    if (!containerRef.current || timelineRef.current) return;

    // Create datasets
    itemsDataSetRef.current = new DataSet(items);
    groupsDataSetRef.current = groups ? new DataSet(groups) : null;

    // Create timeline
    const timeline = new Timeline(containerRef.current, itemsDataSetRef.current, groupsDataSetRef.current, {
      ...options,
      start: defaultTimeStart,
      end: defaultTimeEnd
    });

    // Add event listeners
    if (onItemClick) {
      timeline.on('click', (properties) => {
        if (properties.item) {
          onItemClick(properties.item);
        }
      });
    }

    if (onItemSelect) {
      timeline.on('select', (properties) => {
        if (properties.items.length > 0) {
          onItemSelect(properties.items[0]);
        }
      });
    }

    timelineRef.current = timeline;

    // Cleanup
    return () => {
      if (timelineRef.current) {
        timelineRef.current.destroy();
        timelineRef.current = null;
      }
    };
  }, []); // Only initialize once
  
  // Update data when items/groups change
  useEffect(() => {
    if (!timelineRef.current || !itemsDataSetRef.current) return;
    
    // Update items
    itemsDataSetRef.current.clear();
    itemsDataSetRef.current.add(items);
    
    // Update groups if needed
    if (groups && groupsDataSetRef.current) {
      groupsDataSetRef.current.clear();
      groupsDataSetRef.current.add(groups);
    }
  }, [items, groups]);

  return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
};

export default VisTimelineWrapper;