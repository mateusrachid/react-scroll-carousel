const { useCallback, useEffect, useMemo, useRef, useState, createElement } = require('react');
const styled = require('styled-components');

const Root = styled.div`
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  overflow: hidden;
`;
const ScrollElement = styled.div`
  overflow-x: scroll;
  overflow-y: hidden;
`;
const Wrapper = styled.div`
  display: inline-block;
`;
const TrackElement = styled.div`
  & > *{
    scroll-snap-align: ${p => p.$align};
  }
`;
const DefaultTrack = styled.div`
  width: max-content;
  & > *{
    display: inline-block;
    max-width: 100vw;
  }
`;

const animationDuration = 450;

exports.default = function ScrollCarousel({
  setCurrentSlide=()=>{},
  currentSlide=0,
  children,
  track=DefaultTrack,
  autoplayInterval=0,
  autoplayWait=10000,
  align='start',
  snap=true,
  style={},
  debug,
  ...props
}){

  // dom information

  const scrollElement = useRef();

  const viewWidth = useRef(1);
  const [slideWidth,setSlideWidth] = useState(1);
  const [offsets,setOffsets] = useState([]);

  const numberOfSlides = useMemo(()=>(
    (children === null) ? 0 :
    Array.isArray(children) ? children.flat().length :
    0
  ),[children]);

  const [preferedRootHeight,setPreferedRootHeight] = useState('auto');  

  useEffect(()=>{
    const updateRefs = ()=>{
      if(scrollElement.current)
        setTimeout(()=>{
          viewWidth.current = scrollElement.current.clientWidth;
          const scrollWidth = scrollElement.current.scrollWidth;
          
          const slides = scrollElement.current.firstElementChild.firstElementChild.children;
          const offsetsTemp = [];
          var i = 0;
          for(var el of slides)
            offsetsTemp[i++] = el.offsetLeft - scrollElement.current.offsetLeft;
          setOffsets(offsetsTemp);

          setSlideWidth(scrollWidth / numberOfSlides);
          setPreferedRootHeight(scrollElement.current.clientHeight - 10);
        },1000);
    };
    updateRefs();

    const resize = (ev)=>{
      updateRefs();
    };
    window.addEventListener('resize',resize);
    return ()=>{
      window.removeEventListener('resize',resize);
    };
  },[numberOfSlides]);

  const slidesPerView = useMemo(()=>(
    Math.round(viewWidth.current / slideWidth)
  ),[slideWidth]);

  const numberOfViews = useMemo(()=>(
    numberOfSlides - slidesPerView + 1
  ),[numberOfSlides,slidesPerView]);
  
  const extraMargin = useMemo(()=>(
    Math.max(0,viewWidth.current - slideWidth*slidesPerView)
  ),[slideWidth,slidesPerView]);

  // autoplay

  const [autoplay,setAutoPlay] = useState(autoplayInterval > 0);
  const autoplayTimeout = useRef();

  const resumeAutoPlay = useCallback(()=>{
    clearTimeout(autoplayTimeout.current);
    autoplayTimeout.current = setTimeout(()=>{
      setAutoPlay(true);
    },autoplayWait);
  },[autoplayWait,autoplayTimeout,setAutoPlay]);

  useEffect(()=>{
    if(!autoplay)
      return;
    const interval = setInterval(()=>{
      setCurrentSlide(x => x+1);
    },autoplayInterval);
    return ()=>{
      clearInterval(interval);
    };
  },[setCurrentSlide,numberOfSlides,autoplay,autoplayInterval]);

  // outside change detection and animation

  const [_snap,setSnap] = useState(true);

  const internalCurrentSlide = useRef(currentSlide);
  const targetScrollLeft = useRef(null);
  const initialScrollLeft = useRef(null);
  const initialScrollTime = useRef(null);

  useEffect(()=>{

    const validated = (currentSlide+numberOfViews) % numberOfViews;
    if(currentSlide !== validated){
      setCurrentSlide(validated);
      return;
    }

    if(internalCurrentSlide.current === currentSlide)
      return;

    setSnap(false);
    setTimeout(()=>{
      targetScrollLeft.current = offsets[currentSlide] || currentSlide * slideWidth;
      initialScrollLeft.current = null;
      initialScrollTime.current = null;
    },100);

    internalCurrentSlide.current = currentSlide;
  },[currentSlide,slideWidth,offsets,internalCurrentSlide,numberOfViews,setCurrentSlide]);
 
  useEffect(()=>{
    const step = (time)=>{
      if(targetScrollLeft.current === null){
        setTimeout(()=>{
          window.requestAnimationFrame(step);
        },300);
        return;
      }

      if(initialScrollTime.current === null){
        initialScrollTime.current = time;
        initialScrollLeft.current = scrollElement.current.scrollLeft;
      }

      const ease = x => -(Math.cos(Math.PI * x) - 1) / 2;

      const t = (time - initialScrollTime.current)/animationDuration;

      if(t > 1){
        targetScrollLeft.current = null;
        setTimeout(()=>{
          setSnap(true);
        },100);
        window.requestAnimationFrame(step);
        return;
      }
      
      scrollElement.current.scrollLeft = (targetScrollLeft.current - initialScrollLeft.current)*ease(t) + initialScrollLeft.current;

      window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
  },[]);

  // current slide detection from scroll position

  const lastScrollComputed = useRef(0);
  useEffect(()=>{
    const container = scrollElement.current;
    const scroll = (ev)=>{
      if(slideWidth === 1)
        return;
      if(targetScrollLeft.current !== null)
        return;
      if(performance.now() - lastScrollComputed.current < 100)
        return;
      
      lastScrollComputed.current = performance.now();

      if(targetScrollLeft.current !== null)
        return;
      
      const slide = Math.round(ev.target.scrollLeft / slideWidth);
      setCurrentSlide(slide);
      internalCurrentSlide.current = slide;
    };
    container.addEventListener('scroll',scroll);
    return ()=>{
      container.removeEventListener('scroll',scroll);
    };
  },[scrollElement,slideWidth,setCurrentSlide]);
  
  // stop animation if touch is detected

  useEffect(()=>{
    const container = scrollElement.current;
    const touch = (ev)=>{
      if(targetScrollLeft.current !== null){
        targetScrollLeft.current = null;
        setSnap(true);
      }
      setAutoPlay(false);
    };
    const touchEnd = (ev)=>{
      resumeAutoPlay();
    };
    container.addEventListener('touchstart',touch);
    container.addEventListener('touchmove',touch);
    container.addEventListener('touchend',touchEnd);
    container.addEventListener('touchcancel',touchEnd);
    return ()=>{
      container.removeEventListener('touchstart',touch);
      container.removeEventListener('touchmove',touch);
      container.removeEventListener('touchend',touchEnd);
      container.removeEventListener('touchcancel',touchEnd);
    };
  },[resumeAutoPlay]);

  // debug

  if(debug)
    console.log({
      viewWidth: viewWidth.current,
      slideWidth,
      offsets,
      numberOfSlides,
      slidesPerView,
      extraMargin
    });

  // render

  return createElement(
    Root,{
      ...props,
      style: {
        ...style,
        height: preferedRootHeight,
      }
    },createElement(
      ScrollElement,{
        ref:  scrollElement,
        style: {
          scrollSnapType: snap && _snap ? 'x mandatory' : 'none',
        }
      },
      createElement(
        Wrapper,{
          style: {
            marginRight: `${extraMargin}px`
          }
        },createElement(
          TrackElement,{
            as: track,
            $align: align,
          },
          children
        )
      )
    )
  );
};
